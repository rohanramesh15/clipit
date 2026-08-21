# Phase 2: Replace Custom Auth with Supabase Auth

## Context

This is Phase 2 of the same 3-phase migration as `SUPABASE_MIGRATION_PLAN.md` (in the repo root — that's Phase 1, migrating the database to Supabase, currently in progress with Codex on Steps 4-5). Phase 2 replaces the app's custom JWT + hand-rolled Google Identity Services auth with Supabase Auth — full replacement, both email/password and Google OAuth move to Supabase. Phase 3 (AWS App Runner hosting) is still a separate future plan, not started.

This uses the **same Supabase project** created in Phase 1 (ref `pyvyjdzwjgdbainzoiug`) — just configuring its Auth settings, not creating a new project.

**Why this design**: the current auth system is small on its own (6 backend endpoints, one `AuthContext`), but `get_current_user`/`get_current_user_optional` gate **62 endpoints across 9 route files**, and `users.id` (an `Integer` autoincrement PK) is a foreign key target in **16 columns across 15 downstream tables** (chat, community, vocab, flashcards, decks, etc.). Supabase Auth's own user table (`auth.users`) uses a UUID primary key. Changing `users.id` to UUID to match would cascade into all 15 of those tables — a large, risky migration for no real benefit.

**The design that avoids that risk**: keep the local `users` table and its `Integer` PK exactly as-is (zero changes to any of the 15 downstream tables or the 62 gated endpoints), and add a `supabase_user_id` (UUID) column as a mapping key. `get_current_user`'s public contract — takes a Bearer token, returns a `User` ORM object with an integer `.id` — stays identical; only its internals change (verify a Supabase-issued JWT instead of decoding our own). Same idea on the frontend: `AuthContext`'s exported shape (`user`, `token`, `isLoading`, `login`, `loginWithGoogle`, `register`, `logout`) stays identical so all **14 consuming pages/components** need zero changes — only `AuthContext.tsx`'s internals and `GoogleSignInButton.tsx` change.

The user chose to create a **new, dedicated Google OAuth Client ID** for the Supabase integration (not reuse the existing `920806888290-...` one), since Supabase's OAuth flow needs a Client Secret that was never generated for the existing client, and needs a different Authorized Redirect URI (Supabase's own callback, not our app's origins).

## Ownership legend

Same convention as Phase 1 (user asked for ~60% Codex / 40% Claude split):
- **Claude**: Fly secrets/production cutover using the authenticated `flyctl` session, final go/no-go verification.
- **Codex**: the actual code changes (backend + frontend) and local functional testing — this is the bulk of the work.
- **User**: Supabase Auth dashboard configuration and the new Google Cloud OAuth Client — not doable via CLI/agent on the user's behalf.

## Key technical facts (don't re-derive these)

- **Current backend auth** (`app/api/routes/auth.py`, 6 endpoints): `POST /auth/register`, `POST /auth/login`, `POST /auth/google` (verifies Google ID token against `GOOGLE_CLIENT_ID`, creates/matches `User` by email), `GET /auth/me` (returns profile), `DELETE /auth/me` (hard-deletes user + explicitly pre-deletes rows in 8 child tables since not all FKs cascade), `POST /auth/forgot-password` / `POST /auth/reset-password` (custom token + Resend email).
- **`app/core/security.py`**: JWT via `python-jose` (`python-jose[cryptography]==3.3.0`, already a dependency), `SECRET_KEY`/`HS256`, `create_access_token`/`decode_access_token`. Password hashing via raw `bcrypt` (not passlib).
- **`app/api/deps.py`**: `get_current_user` (`HTTPBearer()`, decodes our JWT, looks up `User.id == payload["user_id"]`, 401 on failure) and `get_current_user_optional` (same, returns `None` instead of raising). Both used 62 times across `community.py` (15), `user_vocab.py` (14), `chat.py` (9), `fsrs.py` (8), `videos.py` (7), `anki.py` (3), `decks.py` (3), `auth.py` (2), `lookup.py` (1, optional variant).
- **`app/models/user.py`** (full current schema): `id` (Integer PK, from `BaseModel`), `email`, `username` (deprecated), `full_name`, `hashed_password` (nullable), `is_active`, `is_superuser`, `oauth_provider`, `oauth_id`, `profile_picture`, `reset_token`, `reset_token_expires`.
- **15 tables with a FK to `users.id`** (all `Column(Integer, ForeignKey("users.id"...))`): `chat_session`, `chat_turn`, `chat_memory_fact`, `community_groups` (`creator_id`), `community_memberships`, `community_vocab_lists` (`added_by`), `community_vocab_words` (`added_by`), `deck_settings`, `user_anki_progress`, `user_flashcard_progress`, `user_language_profile`, `user_mined_words`, `user_review_history`, `user_video_watches`, `user_vocabulary_lists`. None of these need any change under this design.
- **Frontend** (`clipit-frontend/src/context/AuthContext.tsx`): stores JWT in `localStorage`/`sessionStorage` (`deadbird_token` key), exposes `{ user, token, isLoading, login, loginWithGoogle, register, logout }`. 14 files call `useAuth()`: `App.tsx`, `Sidebar.tsx`, `FlashcardsPage.tsx`, `LoginPage.tsx`, `AnalyticsPage.tsx`, `ConverseV2Page.tsx`, `CommunityPage.tsx`, `SignupPage.tsx`, `VocabularyUploadPage.tsx`, `VideoPage.tsx`, `SettingsPage.tsx`, `DictionaryPage.tsx`, `PracticePage.tsx`, `MadlibsPage.tsx`, `ConversePage.tsx`.
- **`GoogleSignInButton.tsx`**: hand-rolled against raw `window.google.accounts.id` (GSI popup flow); GSI script tag lives in `clipit-frontend/index.html`. `@react-oauth/google`'s `GoogleOAuthProvider` wraps the whole app in `App.tsx` but none of its actual hooks/components are used anywhere — pure dead weight already, safe to remove.
- **No existing Supabase packages anywhere** in either `package.json` or `requirements.txt` — clean slate, nothing to reconcile.
- **Supabase JWT verification**: Supabase now issues asymmetric (ES256) JWTs by default, verifiable via its JWKS endpoint at `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` (cached 10 min at Supabase's edge). Legacy HS256 shared-secret verification is also still supported. JWKS is the currently recommended approach — no shared secret needs to live on the backend for it, just fetch+cache the public keys.
- **Supabase Auth user id** (`auth.users.id`) is a UUID — this is what becomes `supabase_user_id` on our local `users` table, extracted from the verified JWT's `sub` claim.

## Ordered Steps

### Step 1 — Configure Supabase Auth + create Google OAuth client — **User** — ✅ mostly done
- ✅ Email provider confirmed enabled. ✅ Google provider enabled.
- ✅ Created a new dedicated Google OAuth Client (Web application, "External" audience, published to production so it's not capped at 100 test users) with Authorized redirect URI `https://pyvyjdzwjgdbainzoiug.supabase.co/auth/v1/callback`. Client ID + Secret pasted into Supabase's Google provider settings and saved.
- ✅ Credentials collected: Supabase **Project URL** = `https://pyvyjdzwjgdbainzoiug.supabase.co`, **anon key** and **service_role key** both obtained (service_role key is backend-only/sensitive — never put it in frontend code or commit it).
- ⚠️ **New-domain cutover required**: Authentication → URL Configuration — set **Site URL** to `https://www.joinclipit.com`; allow `http://localhost:5173/**`, `https://joinclipit.com/**`, and `https://www.joinclipit.com/**`. Without this, Supabase will reject OAuth and password-reset redirects on the new production domain.

### Step 2 — Backend: add `supabase_user_id` mapping column — **Codex**
- New Alembic migration (append at current head): `ALTER TABLE users ADD COLUMN supabase_user_id ...` — use Postgres's native `UUID` type (`from sqlalchemy.dialects.postgresql import UUID`; `Column(UUID(as_uuid=True), unique=True, index=True, nullable=True)` — nullable since this is additive, not backfilling anything, consistent with Phase 1's "fine to start fresh" stance).
- Update `app/models/user.py` to add the matching `supabase_user_id` column.
- Do **not** drop `hashed_password`/`oauth_provider`/`oauth_id`/`reset_token`/`reset_token_expires`/`username` in this step — stop writing to them (Step 3), but leave the columns in place. Dropping them is an easy, low-risk follow-up cleanup once Phase 2 is verified stable; not blocking here.

### Step 3 — Backend: swap auth verification internals — **Codex**
- Add JWKS-based JWT verification to `app/api/deps.py`. Reuse `python-jose` (already a dependency) rather than adding a new JWT library if it can fetch/cache a JWKS and verify ES256 — otherwise add `PyJWT` with `PyJWKClient` (`pip install pyjwt`) if that's meaningfully simpler; either is fine, pick based on what's cleanest to implement, but avoid running two JWT libraries side-by-side once the swap is done (retire `python-jose` if replaced).
- Add config: `SUPABASE_URL: str` to `app/core/config.py` (JWKS URL derived as `f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"`; also needed for the Admin API in `/auth/me` DELETE). Add `SUPABASE_SERVICE_ROLE_KEY: str = ""`.
- Rewrite `get_current_user`: verify the Bearer token against the Supabase JWKS (algorithm ES256), extract `sub` (UUID) from the verified payload. Look up `db.query(User).filter(User.supabase_user_id == sub).first()`. **If not found, just-in-time provision**: create a local `User` row from the JWT's claims (`email`, and `user_metadata.full_name`/`user_metadata.avatar_url` if present — Supabase's Google provider populates these from the Google profile automatically), set `supabase_user_id = sub`, commit, return it. This removes the need for a separate webhook/sync mechanism. Keep the same 401 behavior on verification failure. Update `get_current_user_optional` the same way.
- Retire (delete) the now-obsolete routes in `app/api/routes/auth.py`: `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/forgot-password`, `POST /auth/reset-password` — the frontend will call Supabase directly for all of these going forward, not our backend.
- Keep `GET /auth/me` (now backed by the new `get_current_user`) and `DELETE /auth/me` — extend the delete handler to also call the Supabase Admin API (`https://<project>.supabase.co/auth/v1/admin/users/<supabase_user_id>` with the `service_role` key, or use Supabase's Python client if adding it backend-side is preferred) to delete the actual Supabase Auth user after the local cascade-delete succeeds, so no orphaned Supabase account is left behind.
- `app/core/security.py`: remove `create_access_token`/`decode_access_token` and password-hashing functions once nothing calls them (grep to confirm before deleting).

### Step 4 — Frontend: Supabase client + AuthContext rewrite — **Codex**
- `npm install @supabase/supabase-js` in `clipit-frontend/`.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `clipit-frontend/.env` and `.env.production` (anon key is safe to expose client-side, that's its purpose).
- New file `clipit-frontend/src/lib/supabaseClient.ts`: `createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`.
- Rewrite `AuthContext.tsx` internals — **keep the exported shape identical** (`{ user, token, isLoading, login, loginWithGoogle, register, logout }`) so the 14 consuming files need zero changes:
  - `login(email, password)` → `supabase.auth.signInWithPassword(...)`.
  - `register(fullName, email, password)` → `supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })`.
  - `loginWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` — **this is a redirect flow** (full-page navigation to Google and back), not the current popup. Flag this to the user as a real, visible UX change from today's behavior.
  - `logout()` → `supabase.auth.signOut()`.
  - Session/token: use `supabase.auth.onAuthStateChange((event, session) => ...)` to react to sign-in/out, `session.access_token` is what gets sent as `Authorization: Bearer` to our backend. After a session appears, call our retained `GET /api/auth/me` with that token to fetch the local profile (integer `id`, etc.) and populate `AuthUser` state — this is the bridge that keeps the rest of the app's `user.id: number` usage working unchanged.
- `GoogleSignInButton.tsx`: replace the hand-rolled `window.google` logic with a call to the new `loginWithGoogle()` from `AuthContext`. Remove the hidden-button/GSI-script-polling machinery entirely.
- `App.tsx`: remove the `GoogleOAuthProvider` wrapper (`@react-oauth/google`) — confirmed dead code, nothing else uses it.
- `clipit-frontend/index.html`: remove the `https://accounts.google.com/gsi/client` script tag.
- `package.json`: remove `@react-oauth/google` dependency once confirmed unused.
- `ForgotPasswordPage.tsx` / `ResetPasswordPage.tsx`: rewrite to call `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })` and `supabase.auth.updateUser({ password })` respectively, instead of hitting our now-removed backend endpoints.

### Step 5 — Functional regression pass — **Codex**
Against the app running locally (frontend + backend, backend still pointed at whatever `DATABASE_URL` Phase 1 left it on — local Docker Postgres, per Phase 1's decision):
- ✅ ES256 JWKS verification + JIT local-user provisioning confirmed (Codex).
- ✅ Repeated `/auth/me` calls confirmed no duplicate user rows.
- ✅ Protected FSRS, vocabulary, and community endpoints confirmed working with the new JWKS-based `get_current_user` (Codex).
- ✅ Account deletion confirmed both locally and via the Supabase Admin API — deleted user cannot sign in again (Codex used the **new `sb_secret_...` key format**, not the legacy `service_role` JWT — this project uses Supabase's newer API key system; the legacy key displayed on the "Legacy anon, service_role API keys" tab is not reliably usable, use "Publishable and secret API keys" tab instead going forward).
- ✅ Backend migration + frontend production build both confirmed clean (Codex).
- ✅ **Google OAuth redirect chain verified end-to-end by Claude via browser automation**: clicking "Sign up with Google" on `localhost:5173` correctly redirects through Supabase (`pyvyjdzwjgdbainzoiug.supabase.co`) to Google's real consent screen, using the new dedicated Google Client ID (`382647375047-...`), requesting only `email`+`profile` scopes. Stopped at the account chooser deliberately — completing an actual sign-in requires the user's own credentials/consent, not something Claude does on their behalf. **User still needs to click through an actual account once to fully confirm the JIT-provisioning + profile-picture/name sync works for a real Google account**, but the wiring itself (client ID, redirect URI, scopes, Supabase config) is proven correct.
- ⏳ Public email/password signup hit Supabase's rate limit (429 `over_email_send_rate_limit`) during testing — expected on a fresh free-tier project, not a config bug. Retry after the limit resets (typically resets hourly).
- ⏳ Logout needs a real browser session to fully confirm (should work — `supabase.auth.signOut()` is a standard, well-tested call — but wasn't explicitly clicked through yet).

**Step 5 is effectively complete.** Only remaining before Step 6: user completes one real Google sign-in click-through, and the rate-limited email-signup retry once Supabase's limit resets. Neither blocks starting Step 6 prep, but both should be confirmed before considering Phase 2 fully closed.

### Step 6 — Production cutover — **Claude** — ✅ DONE (backend only, with a real incident along the way)
- Committed Codex's Phase 2 changes (`7a27f47`), set `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (using the working `sb_secret_...` key format) as Fly secrets, and ran `fly deploy`.
- **Caused a brief production outage.** This was the first time the Alembic chain fixed earlier this session ever ran against a real, already-populated database — production's real Neon DB already had `cv2_profile` and other tables created out-of-band via `main.py`'s `Base.metadata.create_all()` footgun, at an older `alembic_version` than my new migrations expect, so `alembic upgrade head` tried to `CREATE TABLE cv2_profile` again and crashed both machines.
- **Compounding complication**: `mcp__Neon__get_connection_string`'s "default branch" resolution pointed at the *wrong* Neon endpoint (`ep-orange-base-aikgzdc3`) — a different branch/compute than what `DATABASE_URL` on Fly actually points to (`ep-young-hall-aigot6m0`). My first fix attempt (stamp + upgrade) landed on the wrong database and did nothing for production; confirmed via `fly ssh console -C "printenv DATABASE_URL"` on a running machine, which is the reliable way to get the *real* value — don't trust Neon MCP's default-branch resolution for a project with multiple branches/endpoints.
- Rolled back to the last known-good image immediately to restore service, then fixed the **real** production database (`alembic stamp c7794ac88acc` then `alembic upgrade head` — skips re-running the CREATE TABLE steps for tables that already exist, applies only the two genuinely-new Phase 2 migrations), verified schema parity first (same drift as everywhere else: missing `supabase_user_id`, plus the pre-existing benign `first_name`/`last_name`/`has_spanish` columns — nothing else), then redeployed the new code. Both machines confirmed healthy on v19, old `/auth/google` route returns 404, `/auth/me` correctly returns 403 without a token.
- **Important newly-discovered fact for Phase 1**: production's real Neon database has **9 extra tables** not in any current SQLAlchemy model — `classes`, `class_members`, `class_invitations`, `class_vocabulary_lists`, `class_vocabulary_words`, `folders`, `folder_videos`, `user_definitions`, `user_skipped_sentences`. These represent real functionality not present in the `clipit-backend` `main` branch this monorepo is built from. **Before ever cutting production over to Supabase for Phase 1, these tables need to be accounted for** (their data would be silently left behind on Neon otherwise) — this monorepo's `main` branch is missing features that exist in whatever branch actually produced these tables.
- **Frontend domain cutover pending** — `.env.production` already has the right `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` values. Attach `www.joinclipit.com` to the selected frontend host, configure the new Supabase URLs, and verify the deployed frontend end-to-end before retiring the old domains.

### Step 7 — Production verification — **Claude** — partially done
- ✅ Backend confirmed healthy and serving the new auth routes correctly.
- ⏳ Full sign-up/sign-in/Google sign-in/logout against the real production frontend — blocked until the frontend is actually redeployed with the new Supabase env vars (see above).
- ⏳ Confirm Supabase dashboard's Authentication → Users table shows real users after a real sign-up.

## Explicitly out of scope for this plan

- Phase 3 (AWS App Runner hosting) — separate future plan.
- Dropping the now-vestigial `users` columns (`hashed_password`, `oauth_provider`, `oauth_id`, `reset_token`, `reset_token_expires`, `username`) — safe low-risk cleanup, deliberately deferred to after Phase 2 is confirmed stable.
- Migrating any existing user accounts — consistent with Phase 1's "fine to start fresh," and this session confirmed via Neon/local testing that no real production user data exists yet worth preserving.
