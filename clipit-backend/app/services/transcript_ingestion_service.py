"""Durable, low-latency processing for streamed YouTube transcript batches."""

from __future__ import annotations

from queue import Empty, Queue
from threading import Lock, Thread

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.transcript_ingestion import TranscriptIngestionChunk, TranscriptIngestionJob
from app.services.korean_tokenizer import extract_korean_words_from_subtitles
from app.services.subtitle_service import save_subtitles_from_extension
from app.services.ukrainian_tokenizer import extract_ukrainian_words_from_subtitles
from app.services.vocab_service import filter_vocabulary


_pending_chunk_ids: Queue[int] = Queue()
_enqueued_ids: set[int] = set()
_queue_lock = Lock()
_worker_started = False


def _extract_words(subtitles: list[dict], language: str) -> list[dict]:
    if language == "uk":
        source_words = extract_ukrainian_words_from_subtitles(subtitles)
    else:
        source_words = extract_korean_words_from_subtitles(subtitles)

    # Import lazily to avoid the vocabulary router importing the ingestion
    # worker while FastAPI constructs its router tree.
    from app.api.routes.vocabulary import get_frequency_map

    return filter_vocabulary(source_words, get_frequency_map(language), language)


def enqueue_transcript_chunk(chunk_id: int) -> None:
    """Queue a persisted chunk once; it remains recoverable in Postgres."""
    with _queue_lock:
        if chunk_id in _enqueued_ids:
            return
        _enqueued_ids.add(chunk_id)
    _pending_chunk_ids.put(chunk_id)


def _append_words(existing: list[dict] | None, incoming: list[dict]) -> list[dict]:
    seen = {item.get("word") for item in existing or []}
    combined = list(existing or [])
    for item in incoming:
        if item.get("word") not in seen:
            seen.add(item.get("word"))
            combined.append(item)
    return combined


def _finish_if_ready(db: Session, job: TranscriptIngestionJob) -> None:
    if job.received_chunks < job.total_chunks or job.processed_chunks < job.total_chunks:
        job.status = "processing"
        return

    chunks = (
        db.query(TranscriptIngestionChunk)
        .filter(TranscriptIngestionChunk.job_id == job.id)
        .order_by(TranscriptIngestionChunk.chunk_index)
        .all()
    )
    if len(chunks) != job.total_chunks or any(chunk.status != "complete" for chunk in chunks):
        job.status = "processing"
        return

    full_transcript = [subtitle for chunk in chunks for subtitle in (chunk.subtitles or [])]
    persisted = save_subtitles_from_extension(
        job.video_id,
        job.language,
        full_transcript,
        has_korean=job.language == "ko",
        has_ukrainian=job.language == "uk",
    )
    if not persisted:
        raise RuntimeError("final transcript persistence failed")
    job.status = "complete"


def process_transcript_chunk(chunk_id: int) -> None:
    db = SessionLocal()
    try:
        chunk = db.query(TranscriptIngestionChunk).filter(TranscriptIngestionChunk.id == chunk_id).first()
        if chunk is None or chunk.status == "complete":
            return
        job = db.query(TranscriptIngestionJob).filter(TranscriptIngestionJob.id == chunk.job_id).first()
        if job is None or job.status in {"complete", "failed"}:
            return

        chunk.status = "processing"
        db.commit()
        words = _extract_words(chunk.subtitles or [], job.language)

        chunk.words = words
        chunk.status = "complete"
        job.words = _append_words(job.words, words)
        # SessionLocal is autoflush=False, so the chunk.status write above is
        # only visible to a query once flushed — without this, the count
        # below always misses the current chunk's own completion. Harmless
        # for every chunk but the last one, where it permanently undercounts
        # processed_chunks by one and _finish_if_ready never fires again.
        db.flush()
        job.processed_chunks = db.query(TranscriptIngestionChunk).filter(
            TranscriptIngestionChunk.job_id == job.id,
            TranscriptIngestionChunk.status == "complete",
        ).count()
        _finish_if_ready(db, job)
        db.commit()
    except Exception as error:
        db.rollback()
        job = db.query(TranscriptIngestionJob).join(
            TranscriptIngestionChunk, TranscriptIngestionChunk.job_id == TranscriptIngestionJob.id
        ).filter(TranscriptIngestionChunk.id == chunk_id).first()
        if job is not None:
            job.status = "failed"
            job.error = str(error)[:500]
            db.commit()
        print(f"[transcript-ingestion] chunk {chunk_id} failed: {error}")
    finally:
        db.close()


def _worker_loop() -> None:
    while True:
        try:
            chunk_id = _pending_chunk_ids.get(timeout=1)
        except Empty:
            continue
        try:
            process_transcript_chunk(chunk_id)
        finally:
            with _queue_lock:
                _enqueued_ids.discard(chunk_id)
            _pending_chunk_ids.task_done()


def start_transcript_worker() -> None:
    """Start the worker and recover chunks persisted before a restart."""
    global _worker_started
    with _queue_lock:
        if _worker_started:
            return
        _worker_started = True
    Thread(target=_worker_loop, name="transcript-ingestion", daemon=True).start()

    db = SessionLocal()
    try:
        pending = db.query(TranscriptIngestionChunk.id).filter(
            TranscriptIngestionChunk.status.in_(("queued", "processing"))
        ).all()
        for (chunk_id,) in pending:
            enqueue_transcript_chunk(chunk_id)
    finally:
        db.close()
