# Phase 1: Migrate Production Database from Neon to Supabase

## Context

This is Phase 1 of a 3-phase migration the user wants to execute one phase at a time, each independently verified before moving to the next:

1. **Phase 1 (this plan)**: Move the production Postgres database to Supabase.
2. Phase 2 (future, not in this plan): Replace the custom JWT + Google Identity Services auth system with Supabase Auth (full replacement — email/password and Google OAuth both move to Supabase).
3. Phase 3 (future, not in this plan): Move backend hosting from Fly.io to AWS App Runner (user has AWS credits covering cost).

Hosting stays on Fly.io during this phase — only the database provider changes. The user explicitly confirmed:
- **No data migration needed** — fine to start fresh on Supabase. The old Neon database is left alone (not deleted) as a rollback safety net.
- **Local dev keeps its existing local Docker Postgres container unchanged** — only production points at Supabase. This avoids shared-DB risk and Supabase free-tier auto-pause from disrupting local dev, and keeps this phase's blast radius small (schema parity is already guaranteed by the Alembic chain, not by which Postgres host is used).

**Why this is happening now**: earlier this session, a real bug was found and fixed in this backend's Alembic migration history — 13 tables had SQLAlchemy models but no `create_table` migration anywhere (they'd only ever been created via `Base.metadata.create_all()` on an already-populated dev DB, never via a true fresh migrate), plus 2 missing columns. This was fixed with 6 new migrations correctly spliced into the revision chain at the historically-accurate point, verified to produce all 27 tables matching every model column-for-column on a genuinely empty database. That fix is the entire enabler of this phase — it's what makes "just run `alembic upgrade head` against a brand new Supabase database" a viable, low-risk path instead of a leap of faith.

The user also asked to split this work with **Codex** (another AI coding agent), targeting roughly **60% Codex / 40% Claude** by effort. Every step below is tagged with an owner.

## Ownership legend

- **Claude**: needs the already-authenticated `flyctl` session (logged in as rohanramesh15@gmail.com), this session's specific migration-repair context, or is a production go/no-go gate.
- **Codex**: mechanical, iterative, or self-contained work that doesn't depend on this session's live context.
- **User**: only the user can create the Supabase project and hand over credentials — not doable via CLI/agent on their behalf, same constraint as the Google Cloud Console work earlier this session.

## Key technical facts (don't re-derive these)

- Current prod DB is on **Neon** (project "project-deadbird", id `calm-poetry-75670186`, confirmed via Neon MCP `list_projects`), set as the `DATABASE_URL` Fly secret on app `project-deadbird-backend`. No Fly Postgres cluster exists.
- Backend is **sync** SQLAlchemy 2.0 (`create_engine`/`sessionmaker`, not async), driver resolves to `psycopg2` (`psycopg2-binary==2.9.11` in `requirements.txt`) via a plain `postgresql://` URL — no driver prefix currently used.
- `app/core/database.py`: `create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)` for non-sqlite URLs. No SSL config currently.
- `alembic/env.py`: reads the same `settings.DATABASE_URL`, uses `NullPool`, nothing Postgres-version-specific.
- **Supabase connection**: use the **Session pooler** connection string (port 5432, IPv4-compatible, username format `postgres.<project-ref>`), NOT the Direct connection (IPv6-only on free tier) and NOT the Transaction pooler on port 6543 (doesn't support prepared statements, Supabase's own docs steer migration tooling away from it). No code in this repo uses `LISTEN`/`NOTIFY` or advisory locks, so nothing blocks Session pooler use.
- **pgvector**: two tables (`subtitle_embedding`, `chat_memory_fact`) have `Vector(768)` columns with HNSW indexes (`vector_cosine_ops`), created via `CREATE EXTENSION IF NOT EXISTS vector` in `alembic/versions/20260522_add_subtitle_embedding.py` (comment there says "Extension is already enabled on the Neon project" — confirms this app ran on Neon before). HNSW needs pgvector ≥ 0.5.0; Supabase ships this on new projects. Raw cosine-distance queries (`<=>` operator) live in `app/services/context_retriever.py` and `app/services/memory_service.py`.
- **Footgun to be aware of**: `main.py` has an **unconditional `Base.metadata.create_all(bind=engine)`** at module level that runs on every app boot for every DB backend, before the sqlite/postgres-specific startup blocks. This can silently paper over a broken Alembic chain — verification must run `alembic upgrade head` standalone (CLI, not via booting the app) as the authoritative check, then confirm `create_all` is a true no-op afterward.
- **Uncommitted state**: `git status` currently shows this session's Alembic-chain repair and the `docker-compose.yml` pgvector-image fix as uncommitted (4 modified files, 6 new untracked files under `alembic/versions/`). If handing work to Codex on a fresh checkout/branch/worktree, it won't see these changes unless committed first.

## Ordered Steps

### Step 0 — ✅ DONE (Claude, commit `92862ff`)
Committed the Alembic-chain repair (11 files: `docker-compose.yml` pgvector image switch + 4 modified/6 new migration files under `alembic/versions/`). Visible to any fresh checkout now.

### Step 1 — ✅ DONE (User)
Supabase project created (ref `pyvyjdzwjgdbainzoiug`, region `us-east-2`). Session pooler connection string obtained and verified working. **Codex: ask the user directly for this connection string when you need it — it is a secret and is deliberately not written into this file or committed anywhere.** Format for reference (values redacted): `postgresql://postgres.pyvyjdzwjgdbainzoiug:<password>@aws-0-us-east-2.pooler.supabase.com:5432/postgres`.

### Step 2 — ✅ DONE (Claude)
Ran `alembic upgrade head` against the fresh Supabase DB directly (all 32 migrations, CLI-only, app not booted first). Results, already verified:
- Exactly 26 tables + `alembic_version` created (matches local dev exactly).
- `Base.metadata` vs. `sqlalchemy.inspect()` column-parity check: **zero real drift**. The only reported diff is `tracked_videos.has_spanish` (extra column) — this is a known, pre-existing benign leftover from migration history, present identically on local dev too; not a Supabase-specific issue, do not "fix" it.
- `vector` extension enabled successfully, both HNSW indexes present (`ix_subtitle_embedding_hnsw`, `ix_chat_memory_fact_hnsw`).
- `Base.metadata.create_all(bind=engine)` confirmed to be a true no-op after migrations ran — Alembic is authoritative, the `main.py` footgun isn't masking anything.

**Codex: do not re-run this verification, it's already confirmed clean. Move straight to Step 4/5.**

### Step 3 — ✅ DONE — no changes needed (Claude)
Step 2 completed with zero errors, so per the plan's own condition, no changes are needed to `app/core/database.py` or `alembic/env.py`. Confirmed: works unmodified against the Session pooler.

### Step 4 — Update docs and stale references — **Codex**
- `clipit-backend/new-backend/.env.example`: add an uncommented `DATABASE_URL` example showing the Supabase Session-pooler format, with a comment explaining why (IPv4 pooler required, port 5432 not 6543, not the Direct connection).
- `clipit-backend/new-backend/test_db_connection.py`: update the "Testing Neon Database Connection" banner text and any Neon-specific wording — this script is a ready-made manual smoke test, reuse it for Step 5.
- `app/services/video_store.py`, `app/services/subtitle_service.py`: update comments/docstrings mentioning "Neon" to be accurate (Supabase, or provider-neutral).
- `clipit-backend/new-backend/DEPLOYMENT.md`: rewrite the database section — it currently documents `flyctl postgres create`/`attach`, which was never actually used in practice (prod has been on Neon). Replace with Supabase project creation + Session pooler connection string + `flyctl secrets set DATABASE_URL=...`.

### Step 5 — Functional regression pass against Supabase — **Codex**
With the app running locally against the Supabase connection (fresh/empty schema):
- Signup + login sanity check (full auth rework is Phase 2 — not in scope here, just confirm today's auth still works against the new DB).
- Create/read a tracked video, flashcard progress, and vocabulary list/word — exercises ORM CRUD across a representative slice of the 27 tables.
- Exercise a subtitle-embedding or chat-memory write/read path that hits the pgvector `Vector(768)` columns and HNSW-indexed similarity query (`app/services/embedding_service.py`, `app/services/context_retriever.py`, `app/services/memory_service.py`) — this is the single highest-risk DB feature for a new provider, deserves an explicit functional test beyond just schema checks.
- Report any failures before Step 6.

### Step 6 — Production cutover — **Claude**
Using the already-authenticated `flyctl` session:
- `fly secrets set DATABASE_URL="<supabase-session-pooler-url>" -a project-deadbird-backend` — triggers an automatic rolling redeploy.
- Watch `fly logs -a project-deadbird-backend` through the restart to confirm `start.sh`'s `alembic upgrade head` step completes cleanly against Supabase from Fly's network (first real test of Fly ↔ Supabase pooler connectivity, distinct from local dev's network path).
- Confirm both machines report healthy and `/api/health` responds (matches the check already configured in `fly.toml`).

### Step 7 — Production verification — **Claude**
- Test a fresh signup, login, and a couple of core flows against `https://theclipitapp.com` end-to-end.
- Spot-check the Supabase dashboard (table editor / logs) to confirm writes are landing.
- Watch Fly logs and Supabase's connection/error metrics for pool exhaustion or connectivity issues over the following 24–48 hours before considering Phase 1 fully closed.

### Step 8 — Rollback plan (if Step 6/7 fails) — **Claude**
`fly secrets set DATABASE_URL="<original Neon connection string>" -a project-deadbird-backend` — instantly reverts to the untouched Neon database. Zero data-loss risk on rollback since Phase 1 never migrated any data out of Neon.

## Verification Summary

1. `alembic upgrade head` (CLI-only, app not booted) against fresh Supabase → exactly 27 tables.
2. `Base.metadata` vs. `sqlalchemy.inspect()` script → zero drift.
3. `vector` extension + both HNSW indexes present.
4. Boot app against Supabase → `Base.metadata.create_all()` is a no-op (proves Alembic is authoritative, not silently relying on the create_all footgun).
5. Functional pass: signup/login, tracked video + flashcard + vocab CRUD, one pgvector similarity-search round trip.
6. Post-cutover: Fly logs show clean `alembic upgrade head` + healthy machines; `theclipitapp.com` signup/login works end-to-end against Supabase; Supabase dashboard shows real writes.

## Update: this plan's production cutover (Steps 6-9) was never executed

Phase 2 (Auth) went ahead and was cut over to production while this plan's DB cutover was still pending. In the process of fixing a production incident during Phase 2's rollout (see `SUPABASE_AUTH_MIGRATION_PLAN.md` Step 6), two important facts about the **real** production Neon database were discovered that this plan's "fine to start fresh" assumption needs to be revisited against before Step 6 of *this* plan ever runs:

1. **Production Neon has 9 tables with real data that don't correspond to any current SQLAlchemy model**: `classes`, `class_members`, `class_invitations`, `class_vocabulary_lists`, `class_vocabulary_words`, `folders`, `folder_videos`, `user_definitions`, `user_skipped_sentences`. These represent functionality that exists in whatever branch/version actually produced production, but is missing from the `clipit-backend` `main` branch this monorepo pulled from. "Fine to start fresh" was said without knowing this — starting fresh on Supabase would silently leave this data (and the features it backs) behind. **Needs a decision from the user before Phase 1's production cutover**: either find/merge the code that defines these tables first, or explicitly confirm it's OK to lose them.
2. **This Neon project has multiple branches/compute endpoints**, and `mcp__Neon__get_connection_string`'s automatic "default branch" resolution does not reliably match what's actually in the `DATABASE_URL` Fly secret — confirmed two different endpoint hostnames (`ep-orange-base-aikgzdc3` vs the real one, `ep-young-hall-aigot6m0`) for the same logical Neon project. **Always verify the real production `DATABASE_URL`** via `fly ssh console -a project-deadbird-backend -C "printenv DATABASE_URL"` on a running machine rather than trusting Neon MCP's default-branch guess, before running any migration/verification against "production."

## Explicitly out of scope for this plan

- Phase 2 (Supabase Auth replacement) and Phase 3 (AWS App Runner hosting) — separate future plans, not started here.
- Any data migration from Neon — user confirmed starting fresh is fine (**now needs revisiting, see above**).
- Changing local dev's database — stays on the local Docker `pgvector/pgvector:pg15` container per user's explicit choice.
