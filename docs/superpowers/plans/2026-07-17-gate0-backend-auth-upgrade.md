# Gate 0 — Backend auth: guest-upgrade-in-place + verification (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Python backend's sign-up (email/password **and** Google) upgrade an anonymous guest **in place** — same user id, org, and uploaded data — then prove the pipeline runs end-to-end on DO Postgres. This is the gate the whole klovered-free migration sits behind.

**Architecture:** `Klovered-python` FastAPI backend, self-issued HS256 sessions, psycopg with RLS (`user_tx` = `SET LOCAL app.user_id`, `admin_tx` = BYPASSRLS for provisioning). Sign-up currently mints a *fresh* user and discards guest work; we change it to convert the guest row when a guest session is present. Google callback gets the same treatment.

**Tech Stack:** Python 3.12, FastAPI, psycopg3, PyJWT, bcrypt, pytest. DO Managed Postgres (pgvector).

**Repo:** `vibe coding/Klovered-python` — all paths below are relative to it.

## Global Constraints

- Mistral is the only AI vendor (LLM + embeddings + OCR). No Anthropic, no Jina.
- No Supabase. Sessions are self-issued HS256; `sub` = user uuid, `is_anonymous` claim separates guests from accounts.
- Two DB roles only: `user_tx(user_id)` (RLS-enforced, app work) vs `admin_tx()` (BYPASSRLS, provisioning/workers). A brand-new/guest user has membership, so upgrades that touch `users`/`organizations` run in `admin_tx`.
- Email is stored normalized (`lower()+strip`); uniqueness is a `lower(email)` index — rely on `UniqueViolation` → 409, never a pre-check race.
- Error copy for "email taken" is exactly: `An account with that email already exists. Sign in instead.`
- Unit tests always run; DB-touching tests use the `requires_db` marker + `client`/`guest` fixtures from `tests/conftest.py`.

---

### Task 1: `optional_guest` dependency + email/password sign-up upgrades a guest in place

**Files:**
- Modify: `app/deps.py` (add `optional_guest`)
- Modify: `app/routers/auth.py:70-102` (the `signup` handler)
- Test: `tests/test_integration.py` (add upgrade cases; DB-gated)

**Interfaces:**
- Consumes: `require_guest` / `GuestContext` (`app/deps.py`), `provision_workspace`/`first_workspace` (`app/provisioning.py`), `mint_account_token`, `hash_password`, `validate_email`, `validate_password` (`app/auth.py`), `set_session_cookie` (`app/cookies.py`).
- Produces: `optional_guest() -> GuestContext | None` — returns the current session context if a valid guest/account cookie or bearer token is present, else `None` (never raises `AuthError`). Used by any handler that wants to *notice* an existing session without requiring one.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_integration.py`:

```python
from tests.conftest import requires_db


@requires_db
def test_signup_upgrades_guest_in_place(client, guest):
    g = guest()
    # A guest uploads nothing here; we assert identity carryover by user_id + org_id.
    r = client.post(
        "/api/auth/signup",
        json={"email": "carry@ex.com", "password": "password123"},
        headers={"Authorization": f"Bearer {g['access_token']}"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_anonymous"] is False
    assert body["email"] == "carry@ex.com"
    # Same identity + workspace as the guest — nothing was thrown away.
    assert body["user_id"] == g["user_id"]
    assert body["org_id"] == g["org_id"]


@requires_db
def test_signup_without_guest_creates_fresh_account(client):
    r = client.post(
        "/api/auth/signup",
        json={"email": "fresh@ex.com", "password": "password123"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["is_anonymous"] is False


@requires_db
def test_signup_duplicate_email_conflicts(client, guest):
    client.post("/api/auth/signup", json={"email": "dup@ex.com", "password": "password123"})
    g = guest()
    r = client.post(
        "/api/auth/signup",
        json={"email": "dup@ex.com", "password": "password123"},
        headers={"Authorization": f"Bearer {g['access_token']}"},
    )
    assert r.status_code == 409
    assert "already exists" in r.json()["error"]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_integration.py -k "upgrades_guest or without_guest or duplicate_email" -v`
Expected: FAIL — `test_signup_upgrades_guest_in_place` fails on `body["user_id"] == g["user_id"]` (current signup mints a new id).

- [ ] **Step 3: Add `optional_guest` to `app/deps.py`**

Append:

```python
async def optional_guest(
    authorization: str = Header(default=""),
    session_cookie: str | None = Cookie(default=None, alias=get_settings().session_cookie_name),
) -> GuestContext | None:
    """Like require_guest, but returns None instead of raising when there is no
    valid session. For handlers (signup, Google callback) that upgrade a guest
    when one exists but must still work for a first-time visitor with no cookie."""
    try:
        return await require_guest(authorization, session_cookie)
    except AuthError:
        return None
```

- [ ] **Step 4: Rewrite the `signup` handler in `app/routers/auth.py`**

Replace the body of `signup` (keep the `@router.post("/signup")` decorator) with:

```python
@router.post("/signup")
async def signup(
    body: Credentials,
    response: Response,
    guest: GuestContext | None = Depends(optional_guest),
) -> dict:
    """Create a real account. If the caller is currently an anonymous guest, we
    UPGRADE that guest in place — same user id, same org, same uploaded work —
    so nothing they did as a guest is lost. With no guest session, a fresh
    account + workspace is created."""
    email = validate_email(body.email)
    password = validate_password(body.password)
    password_hash = hash_password(password)

    try:
        with db.admin_tx() as cur:
            if guest and guest.is_anonymous:
                cur.execute(
                    "UPDATE users SET email = %s, password_hash = %s, is_anonymous = false "
                    "WHERE id = %s AND is_anonymous = true RETURNING id",
                    (email, password_hash, guest.user_id),
                )
                row = cur.fetchone()
                if row:  # guest still exists -> upgraded in place, keep their org
                    user_id = row["id"]
                    org_id, deal_id = _first_workspace(cur, user_id)
                    if org_id is None:
                        org_id, deal_id = _provision_workspace(
                            cur, user_id, "Workspace", f"org-{user_id}", "First proposal"
                        )
                else:  # guest row was purged mid-flight -> fall through to fresh
                    user_id, org_id, deal_id = _fresh_account(cur, email, password_hash)
            else:
                user_id, org_id, deal_id = _fresh_account(cur, email, password_hash)
    except UniqueViolation:
        raise AuthError(409, "An account with that email already exists. Sign in instead.")

    token = mint_account_token(str(user_id))
    set_session_cookie(response, token, get_settings().auth_account_token_ttl_seconds)
    return {
        "access_token": token,
        "user_id": str(user_id),
        "org_id": str(org_id),
        "deal_id": str(deal_id) if deal_id else None,
        "email": email,
        "is_anonymous": False,
    }


def _fresh_account(cur, email: str, password_hash: str):
    """Insert a brand-new account + workspace. Shared by the no-guest path and
    the purged-guest fallback so the two can't drift."""
    user_id = new_user_id()
    cur.execute(
        "INSERT INTO users (id, email, password_hash, is_anonymous) VALUES (%s, %s, %s, false)",
        (user_id, email, password_hash),
    )
    org_id, deal_id = _provision_workspace(cur, user_id, "Workspace", f"org-{user_id}", "First proposal")
    return user_id, org_id, deal_id
```

Add `optional_guest` to the existing `from ..deps import GuestContext, require_guest` line so it reads:
`from ..deps import GuestContext, optional_guest, require_guest`

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest tests/test_integration.py -k "upgrades_guest or without_guest or duplicate_email" -v`
Expected: PASS (3 passed).

- [ ] **Step 6: Run the full unit suite + lint (no regressions)**

Run: `pytest tests/test_unit.py tests/test_accounts.py -v && ruff check app tests`
Expected: all pass, ruff clean.

- [ ] **Step 7: Commit**

```bash
git add app/deps.py app/routers/auth.py tests/test_integration.py
git commit -m "feat(auth): sign-up upgrades an anonymous guest in place (keeps org + data)"
```

---

### Task 2: Google callback upgrades a guest in place

**Files:**
- Modify: `app/routers/google_auth.py:126-177` (`_find_or_create_google_user`, `google_callback`)
- Test: `tests/test_google_auth.py`

**Interfaces:**
- Consumes: `optional_guest`/`GuestContext` (Task 1), `first_workspace`/`provision_workspace`, `db.admin_tx`.
- Produces: `_resolve_google_user(email, guest) -> str` — returns the user id for a verified Google email: an existing account if the email is known; otherwise the current guest upgraded in place; otherwise a fresh account.

- [ ] **Step 1: Write the failing test**

`tests/test_google_auth.py` mocks token verification already (follow its existing pattern). Add a unit-level test of the resolver's branch selection using a fake cursor, matching the file's current style:

```python
def test_resolve_prefers_existing_account_over_guest(monkeypatch):
    from app.routers import google_auth as g
    # existing account with this email -> guest is ignored
    fake = _FakeCur(existing_id="acct-1")   # helper already in this test module's style
    monkeypatch.setattr(g.db, "admin_tx", lambda: _tx(fake))
    guest = _guest_ctx(user_id="guest-9", is_anonymous=True)
    assert g._resolve_google_user("known@ex.com", guest) == "acct-1"


def test_resolve_upgrades_guest_when_email_new(monkeypatch):
    from app.routers import google_auth as g
    fake = _FakeCur(existing_id=None)
    monkeypatch.setattr(g.db, "admin_tx", lambda: _tx(fake))
    guest = _guest_ctx(user_id="guest-9", is_anonymous=True)
    assert g._resolve_google_user("new@ex.com", guest) == "guest-9"
    assert fake.upgraded is True   # UPDATE users ... is_anonymous=false ran on guest-9
```

If `tests/test_google_auth.py` has no fake-cursor helpers, add minimal ones at the top of the file (a `_FakeCur` recording `execute`/`fetchone`, an `_tx` context-manager wrapper, and a `_guest_ctx` returning a `GuestContext`). Keep them local to this test module.

- [ ] **Step 2: Run to verify it fails**

Run: `pytest tests/test_google_auth.py -k resolve -v`
Expected: FAIL — `_resolve_google_user` does not exist yet.

- [ ] **Step 3: Refactor the resolver and callback**

Rename `_find_or_create_google_user(email)` to `_resolve_google_user(email, guest)` and add the guest branch:

```python
def _resolve_google_user(email: str, guest) -> str:
    """Verified Google email -> user id. Existing account wins; else upgrade the
    current guest in place; else create a fresh Google-only account."""
    with db.admin_tx() as cur:
        cur.execute(
            "SELECT id FROM users WHERE lower(email) = %s AND is_anonymous = false LIMIT 1",
            (email,),
        )
        existing = cur.fetchone()
        if existing:
            user_id = existing["id"]
            org_id, _ = first_workspace(cur, user_id)
            if org_id is None:
                provision_workspace(cur, user_id, "Workspace", f"org-{user_id}", "First proposal")
            return str(user_id)

        if guest and guest.is_anonymous:
            cur.execute(
                "UPDATE users SET email = %s, is_anonymous = false "
                "WHERE id = %s AND is_anonymous = true RETURNING id",
                (email, guest.user_id),
            )
            row = cur.fetchone()
            if row:
                return str(row["id"])  # guest upgraded in place, org + data kept

        user_id = new_user_id()
        cur.execute(
            "INSERT INTO users (id, email, is_anonymous) VALUES (%s, %s, false)", (user_id, email)
        )
        provision_workspace(cur, user_id, "Workspace", f"org-{user_id}", "First proposal")
        return user_id
```

Update `google_callback` to read the optional guest and pass it through:

```python
@router.get("/callback")
async def google_callback(
    code: str = Query(default=""),
    state: str = Query(default=""),
    guest: GuestContext | None = Depends(optional_guest),
) -> RedirectResponse:
    ...  # unchanged: config check, code/state check, verify state, exchange+verify token
    email = normalize_email(claims["email"])
    user_id = _resolve_google_user(email, guest)
    token = mint_account_token(user_id)
    ...  # unchanged: RedirectResponse + set_session_cookie
```

Add the imports: `from fastapi import Depends` and `from ..deps import GuestContext, optional_guest`.

- [ ] **Step 4: Run to verify it passes**

Run: `pytest tests/test_google_auth.py -v`
Expected: PASS (existing tests + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add app/routers/google_auth.py tests/test_google_auth.py
git commit -m "feat(auth): Google sign-in upgrades an anonymous guest in place"
```

---

### Task 3: klovered-free Supabase call-site map (analysis deliverable)

**Files:**
- Create: `vibe coding/Propello/docs/superpowers/specs/2026-07-17-klovered-free-supabase-callsite-map.md`

This task produces no code. Its deliverable is the mapping that turns Phase 1 (tool rewire) into a placeholder-free plan and pins down exactly which backend endpoints are still missing.

- [ ] **Step 1: Enumerate every Supabase touch in klovered-free**

Run (from `vibe coding/klovered-free`):
`grep -rn "supabase\|createClient\|\.from(\|\.auth\.\|\.storage\." app lib components utils --include=*.ts --include=*.tsx | grep -v node_modules`

- [ ] **Step 2: Write the map**

For each hit, record a row: `file:line | Supabase call | replacement /api/* endpoint | status (exists | MISSING)`. Group by concern: auth, knowledge, documents, jobs/processing, answers/requirements read, export. Cross-check the replacement column against the backend's actual routes:
`grep -rn "@router\.\(get\|post\|put\|delete\)" ../Klovered-python/app/routers/`

- [ ] **Step 3: List the confirmed gaps explicitly**

At minimum, from the current backend the following are expected MISSING and must be built before Phase 1 can finish (call them out in a "Backend gaps" section, each with the exact tool call site that needs it):
- **Read answers/requirements for a deal** — the tool's `app/answers` + `app/api/answers` read extracted requirements + drafted responses + citations; no backend GET returns these yet.
- **`.docx` export** — the tool's `app/api/exports/*`; no backend export route yet (needs the `docx` port, deferred in `HANDOFF.md`).

- [ ] **Step 4: Commit**

```bash
cd "../Propello"
git add docs/superpowers/specs/2026-07-17-klovered-free-supabase-callsite-map.md
git commit -m "docs: klovered-free Supabase call-site -> /api map + backend gap list"
```

---

### Task 4: Prove the pipeline end-to-end on DO Postgres

**Files:** none changed — this is a verification gate with recorded evidence.

**Interfaces:** Consumes the running backend + a reachable Postgres (DO Managed PG, or local `docker compose up -d db` with pgvector for a dry run first).

- [ ] **Step 1: Confirm DB reachability + schema applied**

```bash
cd "vibe coding/Klovered-python"
# .env.local must hold DATABASE_URL (app_user role) + ADMIN_DATABASE_URL (admin)
python scripts/apply_schema.py    # idempotent; applies db/schema.sql
```
Expected: exits 0; re-runs are no-ops.

- [ ] **Step 2: Run the full test suite against the DB (isolation test included)**

```bash
export DATABASE_URL=... ADMIN_DATABASE_URL=...   # DO PG or local
pytest -v
```
Expected: all pass — crucially the cross-tenant isolation test in `tests/test_integration.py` (one guest cannot read another guest's rows) and the Task 1/2 upgrade tests.

- [ ] **Step 3: Manual end-to-end smoke (guest → upload → process)**

With the API up (`uvicorn app.main:app` or the compose `api` service) and `MISTRAL_API_KEY` set:
```bash
# 1. guest session
curl -s -c jar.txt -X POST localhost:8000/api/auth/guest | tee /tmp/g.json
DEAL=$(python -c "import json;print(json.load(open('/tmp/g.json'))['deal_id'])")
# 2. upload an RFP (sample in ../klovered-free/sample-rfps)
curl -s -b jar.txt -F "file=@../klovered-free/sample-rfps/<sample>.pdf" -F "deal_id=$DEAL" \
  localhost:8000/api/pipeline/documents/upload | tee /tmp/doc.json
DOC=$(python -c "import json;print(json.load(open('/tmp/doc.json'))['document']['id'])")
# 3. process (enqueues + drains in-process)
curl -s -b jar.txt -F "document_id=$DOC" localhost:8000/api/pipeline/documents/process
# 4. drain to completion, then inspect job/requirement rows in psql
curl -s -b jar.txt -X POST localhost:8000/api/pipeline/jobs/drain
```
Expected: `documents.processing_status` advances past `queued`; `extracted_requirements` / `questions` / `responses` rows appear for the deal. Record the observed row counts in the Task 3 doc under an "E2E evidence" heading.

- [ ] **Step 4: Commit the evidence note**

```bash
cd "../Propello"
git add docs/superpowers/specs/2026-07-17-klovered-free-supabase-callsite-map.md
git commit -m "docs: Gate 0 E2E evidence — pipeline runs on DO Postgres"
```

---

## Gate 0 exit criteria

- Sign-up (email/password **and** Google) upgrades a guest in place; verified by tests.
- Full suite green against DO Postgres, isolation test included.
- Pipeline proven guest → upload → extracted, cited answers on DO Postgres.
- Supabase call-site map committed, backend gaps named.

## What comes after Gate 0 (separate plans, in order)

1. **Backend gaps** — implement the answers/requirements read endpoint + `.docx` export named in Task 3. (Own plan; small.)
2. **Phase 1 — tool rewire** (`klovered-free` off Supabase onto `/api/*`, `AuthModal` → `/api/auth/*`, guest-upgrade, local verify). Driven by the Task 3 map. **No live redeploy.**
3. **Phase 2 — marketing auth + link routing.** Port `AuthModal` into `klovered-landing-human`; **fix `lib/links.ts`** so `signin`/`signup` point at the same-domain `/app` tool with the `?auth=` deep link (not the cross-origin `localhost:3100/knowledge`); enable HTTPS on `klovered.com`. → **requires a `web` container redeploy.**
4. **Phase 3 — containerize the tool**, add the `tool` service + Next.js `basePath: "/app"`. → **new container build; no public route yet.**
5. **Phase 4 — Caddy `/app` route → go live.** → **requires a `caddy` redeploy; user-confirmed.**

**Redeployment note for the user:** Gate 0 and Phase 1 touch backend + the (undeployed) tool only — **no redeploy of the live site**. The first change you'll need to deploy is Phase 2 (rebuild/redeploy the `web` marketing container). Going live is Phase 4 (redeploy `caddy`). I'll flag each explicitly when we reach it.
