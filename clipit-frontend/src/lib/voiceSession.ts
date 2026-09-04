// Voice session: WebSocket relay to Gemini Live via the backend.
//
// Upstream:   mic → AudioWorklet (downsample to 16 kHz Int16 PCM) → ws.send(bytes)
// Downstream: ws ArrayBuffer (24 kHz Int16 PCM) → AudioBufferSourceNode chain → speakers
// Control:    JSON text frames in/out (ready, transcripts, interrupted, end)

import { API_BASE_URL } from '../config';

/** Build a ws:// URL from a relative path under the API base (e.g. "/chat/voice/ws"). */
export function buildWsUrl(path: string, params: Record<string, string | number>): string {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${base}${path}${qs ? `?${qs}` : ''}`;
}

export type VoiceEvent =
  | { type: 'ready' }
  | { type: 'connecting' }
  | { type: 'closed'; reason?: string }
  | { type: 'error'; message: string }
  | { type: 'user_transcript'; text: string }
  | { type: 'assistant_transcript'; text: string }
  | { type: 'interrupted' }
  | { type: 'turn_complete'; userTurnId?: number; assistantTurnId?: number }
  | { type: 'mic_level'; level: number }     // 0..1 RMS
  | { type: 'speaker_level'; level: number } // 0..1 RMS
  | { type: 'speaking_changed'; speaking: boolean }
  | { type: 'word_targeted'; word: string }
  | { type: 'word_practiced'; word: string; result: 'forgot' | 'struggled' | 'recalled' | 'mastered' }
  | { type: 'difficulty_changed'; level: string }
  | { type: 'memory_saved'; category?: string }
  | { type: 'session_summary'; summary: Record<string, unknown> };

type Handler = (e: VoiceEvent) => void;

const PLAYBACK_RATE = 24000;
const MIC_RATE = 16000;

export class VoiceSession {
  private ws: WebSocket | null = null;
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private worklet: AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private playCursor = 0;             // when the next chunk should start
  private listeners: Handler[] = [];
  private speaking = false;
  private speakerLevelTimer: number | null = null;
  private lastMicFrameAt = 0;
  private micWatchdog: number | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();

  on(h: Handler) {
    this.listeners.push(h);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== h);
    };
  }

  private emit(e: VoiceEvent) {
    for (const l of this.listeners) l(e);
  }

  private handleInputStateChange = () => {
    if (this.inputCtx?.state === 'suspended') {
      this.inputCtx.resume().catch(() => {});
    }
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (this.inputCtx?.state === 'suspended') this.inputCtx.resume().catch(() => {});
    if (this.outputCtx?.state === 'suspended') this.outputCtx.resume().catch(() => {});
  };

  /** Catches suspensions that don't fire 'statechange' (seen on iOS Safari)
   *  by noticing the worklet has gone quiet — it posts a frame every ~100ms
   *  whenever the context is actually running, silence included. */
  private checkMicHealth() {
    if (!this.inputCtx) return;
    if (this.inputCtx.state === 'suspended') {
      this.inputCtx.resume().catch(() => {});
      return;
    }
    if (Date.now() - this.lastMicFrameAt > 3000) {
      this.inputCtx.resume().catch(() => {});
    }
  }

  async start(url: string) {
    this.emit({ type: 'connecting' });

    // ── Audio I/O ────────────────────────────────────────────────────────────
    this.inputCtx = new AudioContext();
    await this.inputCtx.audioWorklet.addModule('/worklets/pcm-recorder.js');
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
    this.micSource = this.inputCtx.createMediaStreamSource(this.micStream);
    this.worklet = new AudioWorkletNode(this.inputCtx, 'pcm-recorder');
    this.micSource.connect(this.worklet);
    // Don't connect to destination — we don't want mic monitoring.

    this.outputCtx = new AudioContext();
    this.playCursor = this.outputCtx.currentTime;
    // Browsers create AudioContexts 'suspended' unless resumed within a user
    // gesture's call stack — the getUserMedia await above already broke that
    // chain, so without this the tutor's audio is silently never scheduled.
    if (this.inputCtx.state === 'suspended') await this.inputCtx.resume();
    if (this.outputCtx.state === 'suspended') await this.outputCtx.resume();

    // The mic's AudioContext can be suspended again mid-call — e.g. iOS
    // Safari suspends all AudioContexts on screen-lock/backgrounding and
    // doesn't auto-resume them. Since the input graph has no destination
    // connection (see below), the browser is especially likely to treat it
    // as eligible for power-saving suspension. When that happens the
    // worklet silently stops firing: no error, no closed event, just no
    // more mic frames — while the UI keeps showing "listening" because
    // that status comes from server turn-taking messages, not local
    // capture health. Watch for it and resume proactively.
    this.inputCtx.addEventListener('statechange', this.handleInputStateChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.lastMicFrameAt = Date.now();
    this.micWatchdog = window.setInterval(() => this.checkMicHealth(), 2000);

    // ── WebSocket ────────────────────────────────────────────────────────────
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.addEventListener('open', () => {
      // Mic frames start flowing only after the socket is open.
      this.worklet!.port.onmessage = (ev) => {
        const { pcm, rms } = ev.data as { pcm: ArrayBuffer; rms: number };
        this.lastMicFrameAt = Date.now();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(pcm);
        }
        this.emit({ type: 'mic_level', level: Math.min(1, rms * 4) });
      };
    });

    this.ws.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') {
        this.handleControl(ev.data);
      } else {
        this.playPCM(ev.data as ArrayBuffer);
      }
    });

    this.ws.addEventListener('close', (ev) => {
      this.emit({ type: 'closed', reason: ev.reason });
      this.cleanup();
    });

    this.ws.addEventListener('error', () => {
      this.emit({ type: 'error', message: 'Connection error' });
    });
  }

  /** Tell server we're hanging up, then tear down. */
  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.ws.send(JSON.stringify({ event: 'end' })); } catch {}
      try { this.ws.close(1000, 'client end'); } catch {}
    }
    this.cleanup();
  }

  private cleanup() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.micWatchdog != null) {
      clearInterval(this.micWatchdog);
      this.micWatchdog = null;
    }
    if (this.inputCtx) {
      this.inputCtx.removeEventListener('statechange', this.handleInputStateChange);
    }
    if (this.worklet) {
      try { this.worklet.disconnect(); } catch {}
      this.worklet = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch {}
      this.micSource = null;
    }
    if (this.micStream) {
      for (const t of this.micStream.getTracks()) t.stop();
      this.micStream = null;
    }
    if (this.inputCtx) {
      this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
    if (this.outputCtx) {
      this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
    if (this.speakerLevelTimer != null) {
      clearTimeout(this.speakerLevelTimer);
      this.speakerLevelTimer = null;
    }
    for (const src of this.activeSources) {
      try { src.stop(); } catch {}
    }
    this.activeSources.clear();
    this.ws = null;
  }

  private handleControl(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    switch (msg.event) {
      case 'ready':                return this.emit({ type: 'ready' });
      case 'user_transcript':      return this.emit({ type: 'user_transcript', text: msg.text || '' });
      case 'assistant_transcript': return this.emit({ type: 'assistant_transcript', text: msg.text || '' });
      case 'interrupted':          return this.flushPlayback();
      case 'turn_complete':        return this.emit({ type: 'turn_complete', userTurnId: msg.user_turn_id ?? undefined, assistantTurnId: msg.assistant_turn_id ?? undefined });
      case 'word_targeted':        return this.emit({ type: 'word_targeted', word: msg.word || '' });
      case 'word_practiced':       return this.emit({ type: 'word_practiced', word: msg.word || '', result: msg.result });
      case 'difficulty_changed':   return this.emit({ type: 'difficulty_changed', level: msg.level || '' });
      case 'memory_saved':         return this.emit({ type: 'memory_saved', category: msg.category ?? undefined });
      case 'session_summary':      return this.emit({ type: 'session_summary', summary: msg.summary || {} });
      case 'error':                return this.emit({ type: 'error', message: msg.message || 'Unknown error' });
    }
  }

  /** Decode incoming Int16 PCM @ 24 kHz and schedule it on the output context. */
  private playPCM(buf: ArrayBuffer) {
    const ctx = this.outputCtx;
    if (!ctx) return;

    const int16 = new Int16Array(buf);
    const float = new Float32Array(int16.length);
    let sumSq = 0;
    for (let i = 0; i < int16.length; i++) {
      const v = int16[i] / 32768;
      float[i] = v;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, float.length));
    this.emit({ type: 'speaker_level', level: Math.min(1, rms * 4) });

    const audioBuf = ctx.createBuffer(1, float.length, PLAYBACK_RATE);
    audioBuf.copyToChannel(float, 0);
    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);
    this.activeSources.add(src);
    src.onended = () => { this.activeSources.delete(src); };

    const startAt = Math.max(this.playCursor, ctx.currentTime + 0.02);
    src.start(startAt);
    this.playCursor = startAt + audioBuf.duration;

    if (!this.speaking) {
      this.speaking = true;
      this.emit({ type: 'speaking_changed', speaking: true });
    }

    // Drop the speaking flag a beat after the last queued chunk ends.
    if (this.speakerLevelTimer != null) clearTimeout(this.speakerLevelTimer);
    const msUntilDone = Math.max(0, (this.playCursor - ctx.currentTime) * 1000) + 250;
    this.speakerLevelTimer = window.setTimeout(() => {
      this.speaking = false;
      this.emit({ type: 'speaking_changed', speaking: false });
      this.emit({ type: 'speaker_level', level: 0 });
    }, msUntilDone);
  }

  /** Barge-in: stop whatever is already playing and drop anything queued,
   *  so the user can interrupt cleanly instead of hearing the tutor finish
   *  its sentence over them. Resetting playCursor alone (the previous
   *  behavior) only stopped *future* chunks from being scheduled — any
   *  AudioBufferSourceNode already started via src.start() keeps playing to
   *  the end regardless, so it has to be stopped explicitly here too. */
  private flushPlayback() {
    for (const src of this.activeSources) {
      try { src.stop(); } catch {}
    }
    this.activeSources.clear();
    if (this.outputCtx) {
      this.playCursor = this.outputCtx.currentTime;
    }
    if (this.speaking) {
      this.speaking = false;
      this.emit({ type: 'speaking_changed', speaking: false });
    }
  }
}

export const MIC_SAMPLE_RATE = MIC_RATE;
export const SPEAKER_SAMPLE_RATE = PLAYBACK_RATE;
