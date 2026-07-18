# Klovered Free Python Backend — Phase 1 (Scaffold) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a FastAPI service inside `klovered-free/backend/` that verifies a Supabase guest JWT, resolves the caller's org through RLS, and exposes a `/api/pipeline/whoami` probe — the auth/RLS foundation every later phase builds on. No existing route is cut over.

**Architecture:** A standalone FastAPI app runs on `:8000` next to `next dev` on `:3100`. Two Supabase access paths mirror today's TS split: a **user path** (PostgREST called with the guest's forwarded JWT, so Postgres RLS enforces tenant isolation) and a **service-role path** (for later worker code). Phase 1 wires only the user path and proves it end-to-end via `whoami`. Next.js proxies `/api/pipeline/*` to the Python origin so the browser keeps one origin.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, pydantic-settings, PyJWT (`[crypto]`), httpx; pytest + respx for tests. Frontend unchanged (Next.js 15).

## Global Constraints

- Python **3.12+**. All backend code under `klovered-free/backend/`.
- **No database schema changes.** Python reads/writes the same Supabase project as the TS app.
- Supabase env names are fixed by the existing app — use exactly: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the anon/publishable key), `SUPABASE_SERVICE_ROLE_KEY`.
- JWT audience is `"authenticated"`. Verify signatures against the project JWKS at `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (asymmetric keys, matching the TS app's `getClaims()`).
- All Python endpoints are mounted under the prefix **`/api/pipeline`** so the Next.js rewrite can target them without colliding with routes that stay in Next (`/api/session`, `/api/auth/callback`).
- **User path uses the anon/publishable key as PostgREST `apikey` + the guest JWT as `Authorization: Bearer`** — never the service-role key on the request path. Service-role key is worker-path only.
- LLM env contract (for later phases, set now in config): key resolves as `LLM_API_KEY` then `MISTRAL_API_KEY`.
- No route cutover in this phase: the TS routes remain authoritative.

---

### Task 1: Backend scaffold, settings, and health check

**Files:**
- Create: `klovered-free/backend/pyproject.toml`
- Create: `klovered-free/backend/app/__init__.py`
- Create: `klovered-free/backend/app/config.py`
- Create: `klovered-free/backend/app/main.py`
- Create: `klovered-free/backend/.env.example`
- Create: `klovered-free/backend/tests/__init__.py`
- Create: `klovered-free/backend/tests/test_health.py`

**Interfaces:**
- Produces: `app.config.Settings` (pydantic-settings model) and `app.config.get_settings() -> Settings` (lru-cached). Fields: `supabase_url: str`, `supabase_anon_key: str`, `supabase_service_role_key: str`, `supabase_jwt_aud: str = "authenticated"`, `llm_api_key: str = ""`, `mistral_api_key: str = ""`, `cron_secret: str = ""`. Properties: `jwks_url -> str`, `postgrest_url -> str`, `llm_key -> str` (returns `llm_api_key or mistral_api_key`).
- Produces: `app.main.app` (FastAPI instance) with `GET /health` returning `{"status": "ok"}`.

- [ ] **Step 1: Write `pyproject.toml`**

```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "klovered-free-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic-settings>=2.4",
    "pyjwt[crypto]>=2.9",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = ["pytest>=8.3", "respx>=0.21"]

# Explicit package list so editable install doesn't try to discover `tests`
# as a package (flat layout auto-discovery would error on multiple top dirs).
[tool.setuptools]
packages = ["app"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

- [ ] **Step 2: Write `app/config.py`**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Read from the same .env.local the Next.js app uses in local dev; env vars
    # win over the file. Extra keys (the app's many NEXT_PUBLIC_* vars) are
    # ignored so this doesn't error on the shared env file.
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"), extra="ignore", case_sensitive=False
    )

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_aud: str = "authenticated"
    llm_api_key: str = ""
    mistral_api_key: str = ""
    cron_secret: str = ""

    # NOTE: the app's env uses NEXT_PUBLIC_SUPABASE_URL /
    # NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Those names are mapped onto
    # supabase_url / supabase_anon_key in get_settings() below.

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/.well-known/jwks.json"

    @property
    def postgrest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"

    @property
    def llm_key(self) -> str:
        return self.llm_api_key or self.mistral_api_key


@lru_cache
def get_settings() -> Settings:
    import os

    # Honor the NEXT_PUBLIC_* aliases without a custom settings source: read them
    # explicitly and pass as overrides when present.
    overrides = {}
    if os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        overrides["supabase_url"] = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    if os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"):
        overrides["supabase_anon_key"] = os.environ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
    return Settings(**overrides)
```

- [ ] **Step 3: Write `app/main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="Klovered Free — pipeline API")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
```

- [ ] **Step 4: Write `app/__init__.py` and `tests/__init__.py`** (both empty files)

```python
```

- [ ] **Step 5: Write `.env.example`**

```bash
# Point at the same Supabase project the Next.js app uses.
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=service_role_xxx
LLM_API_KEY=
MISTRAL_API_KEY=
CRON_SECRET=
```

- [ ] **Step 6: Write the failing test `tests/test_health.py`**

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 7: Install deps and run the test**

Run (from `klovered-free/backend/`):
```bash
python -m venv .venv && . .venv/Scripts/activate  # Windows Git Bash: .venv/Scripts/activate
pip install -e ".[dev]"
pytest tests/test_health.py -v
```
Expected: PASS (`test_health_ok`).

- [ ] **Step 8: Commit**

```bash
git add klovered-free/backend
git commit -m "feat(backend): FastAPI scaffold, settings, health check"
```

---

### Task 2: Supabase JWT verification

**Files:**
- Create: `klovered-free/backend/app/auth.py`
- Create: `klovered-free/backend/tests/conftest.py`
- Create: `klovered-free/backend/tests/test_auth.py`

**Interfaces:**
- Consumes: `app.config.get_settings`.
- Produces: `app.auth.AuthError(status: int, message: str)` (Exception subclass with `.status` and `.message`).
- Produces: `app.auth.verify_jwt(token: str) -> dict` — returns decoded claims (`sub`, `email`, `is_anonymous`, `user_metadata`, ...) or raises `AuthError(401, ...)` on missing/expired/invalid token.
- Produces (test seam): `app.auth._jwk_client() -> jwt.PyJWKClient` — lru-cached; tests monkeypatch this to avoid network.

- [ ] **Step 1: Write `app/auth.py`**

```python
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from .config import get_settings


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        self.message = message
        super().__init__(message)


@lru_cache
def _jwk_client() -> PyJWKClient:
    # Cached JWKS fetch + in-process key cache, like the TS getClaims() path.
    return PyJWKClient(get_settings().jwks_url)


def verify_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.supabase_jwt_aud,
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError:
        raise AuthError(401, "Session expired")
    except jwt.InvalidTokenError as exc:
        raise AuthError(401, f"Invalid session: {exc}")
    if not claims.get("sub"):
        raise AuthError(401, "No session")
    return claims
```

- [ ] **Step 2: Write `tests/conftest.py`** (RS256 keypair + token factory, no network)

```python
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa


@pytest.fixture(scope="session")
def rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="session")
def public_key(rsa_key):
    return rsa_key.public_key()


@pytest.fixture
def make_token(rsa_key):
    def _make(sub="user-1", aud="authenticated", expired=False, **extra):
        now = int(time.time())
        payload = {
            "sub": sub,
            "aud": aud,
            "exp": now - 60 if expired else now + 3600,
            "iat": now,
            **extra,
        }
        return jwt.encode(payload, rsa_key, algorithm="RS256")

    return _make


@pytest.fixture(autouse=True)
def patch_jwks(monkeypatch, public_key):
    # Replace the network JWKS client with one that returns our test public key.
    class _FakeSigningKey:
        key = public_key

    class _FakeJwkClient:
        def get_signing_key_from_jwt(self, token):
            return _FakeSigningKey()

    from app import auth

    monkeypatch.setattr(auth, "_jwk_client", lambda: _FakeJwkClient())
```

- [ ] **Step 3: Write the failing test `tests/test_auth.py`**

```python
import pytest

from app.auth import AuthError, verify_jwt


def test_valid_token_returns_claims(make_token):
    token = make_token(sub="guest-abc", is_anonymous=True, email="")
    claims = verify_jwt(token)
    assert claims["sub"] == "guest-abc"
    assert claims["is_anonymous"] is True


def test_expired_token_raises_401(make_token):
    token = make_token(expired=True)
    with pytest.raises(AuthError) as exc:
        verify_jwt(token)
    assert exc.value.status == 401


def test_wrong_audience_raises_401(make_token):
    token = make_token(aud="wrong-aud")
    with pytest.raises(AuthError) as exc:
        verify_jwt(token)
    assert exc.value.status == 401
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_auth.py -v`
Expected: PASS (3 tests). `cryptography` is already present via `pyjwt[crypto]`.

- [ ] **Step 5: Commit**

```bash
git add klovered-free/backend/app/auth.py klovered-free/backend/tests
git commit -m "feat(backend): Supabase JWT verification via JWKS"
```

---

### Task 3: PostgREST clients (user path + service path) and org resolution

**Files:**
- Create: `klovered-free/backend/app/supabase_rest.py`
- Create: `klovered-free/backend/tests/test_supabase_rest.py`

**Interfaces:**
- Consumes: `app.config.get_settings`.
- Produces: `app.supabase_rest.SupabaseRest` with `get(self, table: str, params: dict) -> list[dict]`.
- Produces: `app.supabase_rest.user_client(token: str) -> SupabaseRest` — `apikey` = anon key, `Authorization: Bearer <user token>` (RLS applies).
- Produces: `app.supabase_rest.service_client() -> SupabaseRest` — `apikey` and `Authorization` both = service-role key (RLS bypassed; worker path).
- Produces: `app.supabase_rest.resolve_org(token: str, user_id: str) -> str | None` — reads `team_members` on the **user path** and returns `org_id` or `None`.

- [ ] **Step 1: Write `app/supabase_rest.py`**

```python
import httpx

from .config import get_settings


class SupabaseRest:
    """Thin PostgREST client. On the user path, `apikey` is the anon key and the
    Authorization bearer is the guest JWT, so Postgres RLS scopes every row to
    the guest's org. On the service path, both are the service-role key and RLS
    is bypassed (trusted worker code only)."""

    def __init__(self, bearer: str, *, is_service_role: bool = False):
        settings = get_settings()
        self._base = settings.postgrest_url
        apikey = settings.supabase_service_role_key if is_service_role else settings.supabase_anon_key
        self._headers = {
            "apikey": apikey,
            "Authorization": f"Bearer {bearer}",
            "Accept": "application/json",
        }

    def get(self, table: str, params: dict) -> list[dict]:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(f"{self._base}/{table}", headers=self._headers, params=params)
            resp.raise_for_status()
            return resp.json()


def user_client(token: str) -> SupabaseRest:
    return SupabaseRest(token)


def service_client() -> SupabaseRest:
    return SupabaseRest(get_settings().supabase_service_role_key, is_service_role=True)


def resolve_org(token: str, user_id: str) -> str | None:
    rows = user_client(token).get(
        "team_members",
        {"select": "org_id", "user_id": f"eq.{user_id}", "limit": "1"},
    )
    return rows[0]["org_id"] if rows else None
```

- [ ] **Step 2: Write the failing test `tests/test_supabase_rest.py`** (mock PostgREST HTTP with respx)

```python
import httpx
import respx

from app.config import get_settings
from app.supabase_rest import resolve_org, user_client


@respx.mock
def test_user_client_sends_anon_apikey_and_user_bearer(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "anon-key")
    get_settings.cache_clear()

    route = respx.get("https://proj.supabase.co/rest/v1/team_members").mock(
        return_value=httpx.Response(200, json=[{"org_id": "org-9"}])
    )
    org = resolve_org("guest-jwt", "guest-abc")

    assert org == "org-9"
    sent = route.calls.last.request
    assert sent.headers["apikey"] == "anon-key"
    assert sent.headers["authorization"] == "Bearer guest-jwt"


@respx.mock
def test_resolve_org_returns_none_when_no_membership(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "anon-key")
    get_settings.cache_clear()

    respx.get("https://proj.supabase.co/rest/v1/team_members").mock(
        return_value=httpx.Response(200, json=[])
    )
    assert resolve_org("guest-jwt", "nobody") is None
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `pytest tests/test_supabase_rest.py -v`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add klovered-free/backend/app/supabase_rest.py klovered-free/backend/tests/test_supabase_rest.py
git commit -m "feat(backend): PostgREST user/service clients + org resolution"
```

---

### Task 4: `require_guest` dependency, error handler, and `/api/pipeline/whoami`

**Files:**
- Create: `klovered-free/backend/app/deps.py`
- Create: `klovered-free/backend/app/routers/__init__.py`
- Create: `klovered-free/backend/app/routers/probe.py`
- Modify: `klovered-free/backend/app/main.py`
- Create: `klovered-free/backend/tests/test_whoami.py`

**Interfaces:**
- Consumes: `app.auth.verify_jwt`, `app.auth.AuthError`, `app.supabase_rest.resolve_org`.
- Produces: `app.deps.GuestContext` (dataclass: `token: str`, `user_id: str`, `org_id: str`, `is_anonymous: bool`).
- Produces: `app.deps.require_guest(authorization: str = Header(...)) -> GuestContext` — FastAPI dependency; raises `AuthError(401)` if no/!bearer/invalid token, `AuthError(409)` if the user has no org membership.
- Produces: `GET /api/pipeline/whoami -> {"user_id", "org_id", "is_anonymous"}`.
- Produces: exception handler mapping `AuthError` → JSON `{"error": <message>}` with `status_code = err.status`.

- [ ] **Step 1: Write `app/deps.py`**

```python
from dataclasses import dataclass

from fastapi import Header

from .auth import AuthError, verify_jwt
from .supabase_rest import resolve_org


@dataclass
class GuestContext:
    token: str
    user_id: str
    org_id: str
    is_anonymous: bool


async def require_guest(authorization: str = Header(default="")) -> GuestContext:
    if not authorization.lower().startswith("bearer "):
        raise AuthError(401, "No session")
    token = authorization[7:].strip()
    claims = verify_jwt(token)
    org_id = resolve_org(token, claims["sub"])
    if not org_id:
        raise AuthError(409, "Session not provisioned")
    return GuestContext(
        token=token,
        user_id=claims["sub"],
        org_id=org_id,
        is_anonymous=bool(claims.get("is_anonymous", False)),
    )
```

- [ ] **Step 2: Write `app/routers/probe.py`**

```python
from fastapi import APIRouter, Depends

from ..deps import GuestContext, require_guest

router = APIRouter(prefix="/api/pipeline", tags=["probe"])


@router.get("/whoami")
async def whoami(ctx: GuestContext = Depends(require_guest)) -> dict:
    return {"user_id": ctx.user_id, "org_id": ctx.org_id, "is_anonymous": ctx.is_anonymous}
```

- [ ] **Step 3: Write `app/routers/__init__.py`** (empty file)

```python
```

- [ ] **Step 4: Rewrite `app/main.py` to register the router and error handler**

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .auth import AuthError
from .routers import probe

app = FastAPI(title="Klovered Free — pipeline API")


@app.exception_handler(AuthError)
async def _auth_error_handler(_request: Request, exc: AuthError) -> JSONResponse:
    return JSONResponse(status_code=exc.status, content={"error": exc.message})


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


app.include_router(probe.router)
```

- [ ] **Step 5: Write the failing test `tests/test_whoami.py`**

```python
import pytest
from fastapi.testclient import TestClient

from app import deps
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def stub_auth(monkeypatch):
    monkeypatch.setattr(deps, "verify_jwt", lambda token: {"sub": "guest-abc", "is_anonymous": True})
    monkeypatch.setattr(deps, "resolve_org", lambda token, uid: "org-9")


def test_whoami_returns_identity(stub_auth):
    r = client.get("/api/pipeline/whoami", headers={"Authorization": "Bearer guest-jwt"})
    assert r.status_code == 200
    assert r.json() == {"user_id": "guest-abc", "org_id": "org-9", "is_anonymous": True}


def test_whoami_without_bearer_is_401():
    r = client.get("/api/pipeline/whoami")
    assert r.status_code == 401
    assert r.json() == {"error": "No session"}


def test_whoami_unprovisioned_is_409(monkeypatch):
    monkeypatch.setattr(deps, "verify_jwt", lambda token: {"sub": "guest-abc"})
    monkeypatch.setattr(deps, "resolve_org", lambda token, uid: None)
    r = client.get("/api/pipeline/whoami", headers={"Authorization": "Bearer guest-jwt"})
    assert r.status_code == 409
```

- [ ] **Step 6: Run the whole suite**

Run: `pytest -v`
Expected: PASS (all tests across health, auth, supabase_rest, whoami).

- [ ] **Step 7: Commit**

```bash
git add klovered-free/backend/app klovered-free/backend/tests/test_whoami.py
git commit -m "feat(backend): require_guest dependency + /api/pipeline/whoami probe"
```

---

### Task 5: Dockerfile, Next.js rewrite proxy, and two-process dev orchestration

**Files:**
- Create: `klovered-free/backend/Dockerfile`
- Create: `klovered-free/backend/README.md`
- Modify: `klovered-free/next.config.mjs`
- Modify: `klovered-free/package.json` (scripts + `concurrently` devDependency)

**Interfaces:**
- Consumes: `app.main.app` (uvicorn entrypoint), `GET /api/pipeline/whoami`.
- Produces: browser requests to `http://localhost:3100/api/pipeline/*` proxied to `PY_API_URL` (default `http://localhost:8000`); `npm run dev:all` runs Next + uvicorn together.

- [ ] **Step 1: Write `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /srv
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .
COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Add the rewrite to `klovered-free/next.config.mjs`**

Replace the file contents with:
```javascript
/** @type {import('next').NextConfig} */
const PY_API_URL = process.env.PY_API_URL ?? "http://localhost:8000";

const nextConfig = {
  serverExternalPackages: ["pdf-parse", "pdfkit", "pdfjs-dist", "mammoth", "docx", "docxtemplater"],
  async rewrites() {
    // Proxy the Python pipeline API so the browser keeps a single origin
    // (cookies + same-origin fetch). Routes that stay in Next (/api/session,
    // /api/auth/callback) are NOT under /api/pipeline and are unaffected.
    return [{ source: "/api/pipeline/:path*", destination: `${PY_API_URL}/api/pipeline/:path*` }];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Add scripts + dev dependency to `klovered-free/package.json`**

In `"scripts"`, add:
```json
"dev:api": "cd backend && uvicorn app.main:app --reload --port 8000",
"dev:all": "concurrently -n web,api -c blue,green \"npm run dev\" \"npm run dev:api\""
```
In `"devDependencies"`, add:
```json
"concurrently": "^9.1.0"
```
Then run: `npm install`

- [ ] **Step 4: Write `backend/README.md`**

````markdown
# Klovered Free — pipeline backend (FastAPI)

Python backend for the free tool's document/RAG/export pipeline. The Next.js app
stays the frontend and proxies `/api/pipeline/*` here (see `next.config.mjs`).

## Local dev

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # macOS/Linux: . .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env.local   # fill in the same Supabase project as the web app
pytest -v
```

Run both processes from the repo root: `npm run dev:all`
(web on :3100, api on :8000; browser calls `/api/pipeline/*` and Next proxies it).
````

- [ ] **Step 5: Manual end-to-end verification through the proxy**

Run, in three terminals from `klovered-free/`:
```bash
# 1) backend
cd backend && . .venv/Scripts/activate && uvicorn app.main:app --port 8000
# 2) web
npm run dev
# 3) probe: grab a guest access token from the browser devtools (Application →
#    Cookies → sb-...-auth-token, the access_token field) and call through :3100
curl -s http://localhost:3100/api/pipeline/whoami \
  -H "Authorization: Bearer <GUEST_ACCESS_TOKEN>"
```
Expected: `{"user_id":"...","org_id":"...","is_anonymous":true}` — proving the
browser→Next-proxy→FastAPI→PostgREST-with-RLS path works end to end. Without the
header: `{"error":"No session"}` with HTTP 401.

- [ ] **Step 6: Commit**

```bash
git add klovered-free/backend/Dockerfile klovered-free/backend/README.md \
        klovered-free/next.config.mjs klovered-free/package.json klovered-free/package-lock.json
git commit -m "feat(backend): Dockerfile, Next rewrite proxy, two-process dev script"
```

---

## Phase-1 exit criteria

- `pytest -v` green in `klovered-free/backend/` (health, auth, supabase_rest, whoami).
- `curl` through the `:3100` proxy to `/api/pipeline/whoami` with a real guest
  token returns that guest's `org_id`; a second guest's token returns a
  different `org_id` (spot-check of the RLS-forwarding path — the automated
  two-tenant test lands in the phase that cuts over real reads).
- No existing TS route changed; the app behaves exactly as before.

## Not in this phase (later plans)

Parsing/export port (Phase 2), RAG pipeline + eval-parity gate (Phase 3), queue
+ workers (Phase 4), request-surface cutover + two-tenant isolation test in CI
(Phase 5), `lib/` cleanup (Phase 6). See the design spec:
`docs/superpowers/specs/2026-07-13-klovered-free-python-backend-design.md`.
