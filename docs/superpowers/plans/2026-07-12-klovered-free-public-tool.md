# Klovered Free — Public RFP Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a standalone public no-login web tool (`klovered-free`) that runs Klovered's core loop — upload knowledge docs → upload an RFP → get AI-drafted, cited answers → export `.docx` — using Supabase anonymous auth and the existing pipeline.

**Architecture:** New sibling Next.js repo that vendors the RAG pipeline from `Propello/lib/` and points at the **same Supabase project**. Every visitor gets an anonymous `auth.users` row plus an auto-provisioned throwaway org + hidden deal, so all existing RLS and pipeline code run unchanged. UI is a linear 3-step flow reusing the product's existing components and CSS tokens verbatim.

**Tech Stack:** Next.js 16 (App Router, same as Propello), React 19, Tailwind 3, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Mistral (via existing `lib/mistral.ts`), `docx`/`pdfkit` for export.

**Spec:** `Propello/docs/superpowers/specs/2026-07-12-klovered-free-public-tool-design.md`

## Global Constraints

- New repo path: `C:/Users/Khalifa - Applab/OneDrive - applab.qa/Desktop/vibe coding/klovered-free/` (sibling of `Propello/`). All "SOURCE" paths below mean the `Propello/` repo.
- Same Supabase project as Propello: copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MISTRAL_API_KEY` (and `LLM_*` if present), `CRON_SECRET` from `Propello/.env.local`.
- AI provider is **Mistral** — never add Anthropic/OpenAI SDKs.
- **No schema changes, no RLS changes.** Guest orgs are ordinary orgs with slug prefix `guest-`.
- Vendored `lib/` files are copied **unchanged** unless a task shows an exact edit. Copies must stay byte-identical otherwise (later extraction into a shared package depends on this).
- UI: reuse existing CSS variables + components; no redesign. No sidebar/`AppShell`.
- Guardrail values: max **10** knowledge docs per guest org, max **200** total pages, max **1** RFP per session, 50 MB/file (existing), anonymous data expiry **48 h**.
- Google is the only sign-in option (via `linkIdentity`). Per Supabase anonymous-auth docs: the JWT `is_anonymous` claim is the canonical guest/permanent distinction, and `linkIdentity()` requires **manual identity linking enabled** in the Supabase dashboard (Authentication → settings) alongside anonymous sign-ins.
- **Never modify, delete, or push the Propello repo** — it is read-only source material (plus these docs/scratch files). The new repo stays local-only until the user creates its GitHub home.
- Commit after every task (new repo gets `git init` in Task 1).
- Windows shell caveat: use Git Bash (`Bash` tool) for `cp` commands.

---

### Task 1: Scaffold the `klovered-free` repo

**Files:**
- Create: `klovered-free/package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.js`, `tailwind.config.ts`, `.gitignore`, `.env.local`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (copied), `middleware.ts` (copied)

**Interfaces:**
- Produces: a bootable Next.js app with Klovered tokens loaded; `npm run dev` serves a placeholder at `/`.

- [ ] **Step 1: Create repo + git init**

```bash
cd "C:/Users/Khalifa - Applab/OneDrive - applab.qa/Desktop/vibe coding"
mkdir -p klovered-free && cd klovered-free && git init
```

- [ ] **Step 2: Write `package.json`** (subset of Propello's deps — drop `docxtemplater`, `pizzip`, `recharts`, `pdfkit` stays for PDF fallback)

```json
{
  "name": "klovered-free",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=20.x" },
  "scripts": {
    "dev": "next dev -p 3100",
    "build": "next build",
    "start": "next start -p 3100",
    "lint": "eslint ."
  },
  "overrides": { "postcss": "^8.5.10" },
  "dependencies": {
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.105.4",
    "clsx": "^2.1.1",
    "docx": "^9.6.1",
    "mammoth": "^1.8.0",
    "next": "^16.2.6",
    "pdf-parse": "^1.1.1",
    "pdfjs-dist": "^4.10.38",
    "pdfkit": "^0.15.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/pdf-parse": "^1.1.4",
    "@types/pdfkit": "^0.13.5",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.0.0",
    "eslint-config-next": "^16.2.6",
    "postcss": "^8.5.10",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 3: Copy config + styles verbatim from Propello**

```bash
SRC="../Propello"
cp "$SRC/tsconfig.json" "$SRC/next.config.mjs" "$SRC/postcss.config.js" \
   "$SRC/tailwind.config.ts" "$SRC/eslint.config.mjs" "$SRC/middleware.ts" .
mkdir -p app && cp "$SRC/app/globals.css" app/
cp "$SRC/.gitignore" .
```

- [ ] **Step 4: Write `.env.local`** — copy the Supabase/Mistral/CRON values from `Propello/.env.local` verbatim, then add:

```bash
NEXT_PUBLIC_MARKETING_URL=https://klovered.com   # or the landing-human deploy URL
NEXT_PUBLIC_SITE_URL=http://localhost:3100
```

- [ ] **Step 5: Write minimal `app/layout.tsx` and `app/page.tsx`**

```tsx
// app/layout.tsx
import "./globals.css";

export const metadata = { title: "Klovered Free — Answer any RFP" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function Home() {
  return <div className="p-7"><h1 className="page-title">Klovered Free</h1></div>;
}
```

- [ ] **Step 6: Install + verify boot**

```bash
npm install
npm run dev &
# wait, then:
curl -s http://localhost:3100 | grep "Klovered Free"
```
Expected: heading text present, no build errors.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold klovered-free app with Klovered tokens"
```

---

### Task 2: Vendor the pipeline lib + Supabase utils

**Files:**
- Create (copied verbatim from `Propello/`): `lib/parse.ts`, `lib/chunk.ts`, `lib/embeddings.ts`, `lib/mistral.ts`, `lib/retrieval.ts`, `lib/rag.ts`, `lib/ingest.ts`, `lib/extract.ts`, `lib/agents.ts`, `lib/jobs.ts`, `lib/rate-limit.ts`, `lib/docx-export.ts`, `lib/safe-fetch.ts`, `utils/supabase/server.ts`, `utils/supabase/client.ts`, `utils/supabase/admin.ts`, `utils/activity.ts`, `utils/site-url.ts`, `types/pdf-parse.d.ts`

**Interfaces:**
- Produces (used by every later task): `ingestKnowledgeDocument(writer, {id, org_id, filename, file_path, mime_type})`, `retrieveForQuery(supabase, {org_id, query, topK})`, `generateBatchAnswers(...)` / `generateAndPersistAnswer(...)`, `enqueueIngest(admin, {documentId, orgId})`, `runJob/claimJobs/...` from `lib/jobs.ts`, `rateLimit(key, limit, windowMs)`, `renderDocx(...)`, `createClient(cookies)`, `tryCreateAdminClient()`.

- [ ] **Step 1: Copy files**

```bash
SRC="../Propello"
mkdir -p lib utils/supabase types
cp "$SRC"/lib/{parse,chunk,embeddings,mistral,retrieval,rag,ingest,extract,agents,jobs,rate-limit,docx-export,safe-fetch}.ts lib/
cp "$SRC"/utils/supabase/{server,client,admin}.ts utils/supabase/
cp "$SRC"/utils/{activity,site-url}.ts utils/
cp "$SRC"/types/pdf-parse.d.ts types/
```

- [ ] **Step 2: Typecheck; resolve only missing-import errors by copying the missing dep file the same way (do NOT rewrite code).** If a copied file imports something the free tool truly can't have (e.g. `lib/answer-library.ts` from `lib/rag.ts`), copy that file too — vendoring is transitive-closure copying, not editing.

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: vendor RAG pipeline lib and supabase utils from Propello"
```

---

### Task 3: Anonymous session — guest auth, org + hidden deal provisioning

The security-critical core. Every visitor: `signInAnonymously()` → server route provisions `organizations` (slug `guest-<random>`) + `team_members` + one hidden `deals` row (the RFP pipeline requires a deal). Idempotent. RLS stays untouched; isolation comes from the same org scoping real customers get.

**Files:**
- Create: `utils/auth.ts` (free-tool variant), `app/api/session/route.ts`, `lib/use-session.ts` (client hook)

**Interfaces:**
- Produces: `requireGuest()` (server) → `{ user, supabase, member }` or throws 401 JSON (no redirects — the tool auto-provisions instead); `POST /api/session` → `{ org_id, deal_id }`; `useGuestSession()` (client) → `{ ready, orgId, dealId }`.
- Consumes: `getClaimsUser`, `createClient`, `tryCreateAdminClient` from Task 2.

**Manual pre-step (user):** In Supabase Dashboard → Authentication, enable **Anonymous sign-ins** AND **manual identity linking** (required for Task 9's `linkIdentity`), and ensure the Google provider is configured. Note this in the session and wait for confirmation before verifying.

**Canonical guest check (per Supabase docs):** the access token carries an `is_anonymous` boolean claim (`auth.jwt()->>'is_anonymous'` in SQL, `session.user.is_anonymous` in JS). Use it wherever guest-vs-permanent matters; the `guest-` slug is only a cleanup-scan convenience, not the source of truth. The isolation check in Step 4 should also assert the anonymous session's JWT has `is_anonymous: true`.

- [ ] **Step 1: Write `utils/auth.ts`** — copy `getClaimsUser` + `SessionUser` verbatim from `Propello/utils/auth.ts`, then replace the redirecting helpers with API-friendly ones:

```ts
// (below the copied getClaimsUser)
export class AuthError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

export const requireGuest = cache(async () => {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) throw new AuthError(401, "No session");
  const { data: member } = await supabase
    .from("team_members")
    .select("id, org_id, role, name, email")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) throw new AuthError(409, "Session not provisioned");
  return { user, supabase, member };
});
```

- [ ] **Step 2: Write `app/api/session/route.ts`** — idempotent provisioning:

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getClaimsUser } from "@/utils/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Idempotent: if this user already has a membership, return it.
  const { data: existing } = await admin
    .from("team_members").select("org_id").eq("user_id", user.id)
    .limit(1).maybeSingle();
  if (existing) {
    const { data: deal } = await admin
      .from("deals").select("id").eq("org_id", existing.org_id)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    return NextResponse.json({ org_id: existing.org_id, deal_id: deal?.id ?? null });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`session:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many sessions" }, { status: 429 });
  }

  const slug = `guest-${crypto.randomUUID().slice(0, 12)}`;
  const { data: org, error: orgErr } = await admin
    .from("organizations").insert({ name: "Guest workspace", slug })
    .select().single();
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

  const { error: memberErr } = await admin.from("team_members").insert({
    org_id: org.id, user_id: user.id, role: "owner",
    email: user.email ?? "", name: "Guest",
  });
  if (memberErr) {
    await admin.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }
  await admin.from("org_settings").insert({ org_id: org.id });

  const { data: deal, error: dealErr } = await admin
    .from("deals")
    .insert({ org_id: org.id, name: "Free tool session", status: "in_progress", owner_id: user.id })
    .select("id").single();
  if (dealErr) return NextResponse.json({ error: dealErr.message }, { status: 500 });

  return NextResponse.json({ org_id: org.id, deal_id: deal.id });
}
```

- [ ] **Step 3: Write `lib/use-session.ts`** (client hook — lazy anonymous sign-in on first mount):

```ts
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function useGuestSession() {
  const [state, setState] = useState<{ ready: boolean; orgId: string | null; dealId: string | null }>({
    ready: false, orgId: null, dealId: null,
  });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) { console.error(error); return; }
      }
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) return;
      const { org_id, deal_id } = await res.json();
      setState({ ready: true, orgId: org_id, dealId: deal_id });
    })();
  }, []);

  return state;
}
```

- [ ] **Step 4: Verify isolation (the critical check).** With dev server running, script two fresh anonymous sessions and confirm cross-org reads return nothing. Run in Node (scratchpad script) using `@supabase/supabase-js` with the anon key: sign in anonymously twice (two clients), provision via `POST /api/session` with each client's access token cookie… Simplest reliable form — use the Supabase JS client directly against the DB:

```js
// scratchpad/isolation-check.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a = createClient(url, anon), b = createClient(url, anon);
await a.auth.signInAnonymously(); await b.auth.signInAnonymously();
// provision org A via REST route using A's JWT
const tokA = (await a.auth.getSession()).data.session.access_token;
const resA = await fetch("http://localhost:3100/api/session", { method: "POST", headers: { Authorization: `Bearer ${tokA}` } });
// NOTE: if the route only reads cookie sessions, set the sb cookies instead — see server.ts cookie names.
const { org_id } = await resA.json();
// B tries to read A's org rows — must get zero rows
const { data } = await b.from("knowledge_documents").select("id").eq("org_id", org_id);
console.log("cross-org rows visible to B:", data?.length ?? 0); // MUST be 0
```
Expected output: `cross-org rows visible to B: 0`. If the `/api/session` route can't accept a Bearer token, verify manually with two browsers (normal + incognito) instead: upload a doc in one, confirm the other's `/api/knowledge` list is empty. **Do not proceed past this task until isolation is confirmed.**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: anonymous guest sessions with throwaway org + hidden deal"
```

---

### Task 4: Knowledge API routes (public wrappers with caps)

**Files:**
- Create: `app/api/knowledge/route.ts` (GET list), `app/api/knowledge/upload/route.ts` (POST), `app/api/knowledge/[id]/route.ts` (GET status, DELETE)

**Interfaces:**
- Consumes: `requireGuest`, `ingestKnowledgeDocument`, `rateLimit`, `tryCreateAdminClient`.
- Produces: same JSON shapes the existing `KnowledgeView` expects: upload → `{ knowledge_document }`; GET `/api/knowledge` → `{ items }`; GET `/api/knowledge/[id]` → `{ knowledge_document }` (with `stage`, `ingestion_status`, `error_message`).

- [ ] **Step 1: Copy the source routes, then apply the free-tool edits.**

```bash
SRC="../Propello"
mkdir -p app/api/knowledge/upload "app/api/knowledge/[id]"
cp "$SRC/app/api/knowledge/route.ts" app/api/knowledge/
cp "$SRC/app/api/knowledge/upload/route.ts" app/api/knowledge/upload/
cp "$SRC/app/api/knowledge/[id]/route.ts" "app/api/knowledge/[id]/"
```
(Do **not** copy `drive-import`, `scrape`, `reingest`.)

- [ ] **Step 2: Edit `upload/route.ts`** — replace the auth prelude (user + member lookup, lines 13–23 in source) with `requireGuest()` inside a try/catch that maps `AuthError` to its status, and insert caps + rate limit before the file handling:

```ts
import { requireGuest, AuthError } from "@/utils/auth";
import { rateLimit } from "@/lib/rate-limit";

const MAX_DOCS = 10;
const MAX_TOTAL_PAGES = 200;

export async function POST(req: Request) {
  let ctx;
  try { ctx = await requireGuest(); }
  catch (e) { const s = e instanceof AuthError ? e.status : 401;
    return NextResponse.json({ error: "No session" }, { status: s }); }
  const { user, supabase, member } = ctx;

  if (!rateLimit(`upload:${member.org_id}`, 20, 60 * 60 * 1000))
    return NextResponse.json({ error: "Rate limit — try again later" }, { status: 429 });

  const { data: docs } = await supabase
    .from("knowledge_documents").select("id, page_count").eq("org_id", member.org_id);
  if ((docs?.length ?? 0) >= MAX_DOCS)
    return NextResponse.json({ error: `Free limit: ${MAX_DOCS} documents. Sign in to add more.` }, { status: 403 });
  const totalPages = (docs ?? []).reduce((s, d) => s + (d.page_count ?? 0), 0);
  if (totalPages >= MAX_TOTAL_PAGES)
    return NextResponse.json({ error: `Free limit: ${MAX_TOTAL_PAGES} pages total. Sign in for more.` }, { status: 403 });

  // ... rest of the copied route body unchanged (form parsing, storage upload,
  // insert, ingestKnowledgeDocument, logActivity) — it already uses
  // member.org_id and user.id, which requireGuest supplies.
```

- [ ] **Step 3: Apply the same auth-prelude swap to `route.ts` (GET) and `[id]/route.ts`** — mechanical: replace `requireMembership()`/manual member lookup with the `requireGuest()` try/catch shown above; no other logic changes.

- [ ] **Step 4: Verify end-to-end by curl** (needs a browser-established session; simplest: run after Task 6's UI exists — for now verify typecheck + route compiles):

```bash
npx tsc --noEmit && npm run build
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: public knowledge API with guest caps and rate limits"
```

---

### Task 5: RFP upload + processing + answers API

**Files:**
- Create (copied, then guest-auth swap as in Task 4): `app/api/documents/upload/route.ts`, `app/api/documents/process/route.ts`, `app/api/documents/[id]/route.ts`, `app/api/jobs/drain/route.ts`, `app/api/exports/generate/route.ts`, `app/api/exports/[id]/download/route.ts`
- Create new: `app/api/answers/route.ts`

**Interfaces:**
- Consumes: `requireGuest`, hidden `deal_id` from `useGuestSession`, `enqueueIngest`/jobs from Task 2.
- Produces: `POST /api/documents/upload` (multipart, `deal_id` field) → `{ document }`; `POST /api/documents/process` `{ document_id }` → `{ ok }`; `GET /api/answers?deal_id=…` → `{ questions: [{ id, question_text, status, response: { answer_text, confidence, gap_flag, citations: [{ chunk_id, filename, page_start }] } | null }] }`; `POST /api/exports/generate` `{ deal_id, format: "docx", citation_style: "inline" }` (unchanged from source).

- [ ] **Step 1: Copy routes**

```bash
SRC="../Propello"
mkdir -p app/api/documents/upload app/api/documents/process "app/api/documents/[id]" \
         app/api/jobs/drain app/api/exports/generate "app/api/exports/[id]/download"
cp "$SRC/app/api/documents/upload/route.ts" app/api/documents/upload/
cp "$SRC/app/api/documents/process/route.ts" app/api/documents/process/
cp "$SRC/app/api/documents/[id]/route.ts" "app/api/documents/[id]/"
cp "$SRC/app/api/jobs/drain/route.ts" app/api/jobs/drain/
cp "$SRC/app/api/exports/generate/route.ts" app/api/exports/generate/
cp "$SRC/app/api/exports/[id]/download/route.ts" "app/api/exports/[id]/download/"
```

- [ ] **Step 2: Guest-auth swap** in `documents/upload`, `documents/[id]`, `exports/*` — same mechanical `requireGuest()` replacement as Task 4 Step 2. In `documents/upload`, additionally enforce the 1-RFP cap:

```ts
const { count } = await supabase
  .from("documents").select("id", { count: "exact", head: true })
  .eq("deal_id", deal_id);
if ((count ?? 0) >= 1)
  return NextResponse.json({ error: "Free limit: one RFP per session. Delete the current one first." }, { status: 403 });
```
`documents/process` and `jobs/drain` keep their existing auth (process checks the doc through user-context RLS; drain is `CRON_SECRET`-gated) — only swap `getClaimsUser` boilerplate for `requireGuest` in `process`.

- [ ] **Step 3: Write `app/api/answers/route.ts`**

```ts
import { NextResponse } from "next/server";
import { requireGuest, AuthError } from "@/utils/auth";

export async function GET(req: Request) {
  let ctx;
  try { ctx = await requireGuest(); }
  catch (e) { return NextResponse.json({ error: "No session" }, { status: e instanceof AuthError ? e.status : 401 }); }
  const { supabase } = ctx;

  const dealId = new URL(req.url).searchParams.get("deal_id");
  if (!dealId) return NextResponse.json({ error: "deal_id required" }, { status: 400 });

  // RLS scopes everything to the guest's org; a foreign deal_id returns [].
  const { data: docs } = await supabase.from("documents").select("id").eq("deal_id", dealId);
  const docIds = (docs ?? []).map((d) => d.id);
  if (docIds.length === 0) return NextResponse.json({ questions: [] });

  const { data: questions } = await supabase
    .from("questions")
    .select("id, question_text, status, responses(id, answer_text, confidence, gap_flag, citations(chunk_id, document_chunks(page_start, knowledge_documents(filename))))")
    .in("document_id", docIds)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    questions: (questions ?? []).map((q: any) => {
      const r = Array.isArray(q.responses) ? q.responses[0] : q.responses;
      return {
        id: q.id, question_text: q.question_text, status: q.status,
        response: r ? {
          answer_text: r.answer_text, confidence: r.confidence, gap_flag: r.gap_flag,
          citations: (r.citations ?? []).map((c: any) => ({
            chunk_id: c.chunk_id,
            filename: c.document_chunks?.knowledge_documents?.filename ?? null,
            page_start: c.document_chunks?.page_start ?? null,
          })),
        } : null,
      };
    }),
  });
}
```
**Note:** verify the nested select names against the live schema (`responses.answer_text` vs `answer_text_with_markers`, citation FK names) with a quick query before finalizing; adjust the select string to the real column names — the shape produced for the client must stay as documented in Interfaces.

- [ ] **Step 4: Build check**

```bash
npx tsc --noEmit && npm run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: RFP upload/process, answers, and export APIs for guests"
```

---

### Task 6: Public shell + 3-step layout

**Files:**
- Create: `components/PublicShell.tsx`, `components/StepNav.tsx`, modify `app/layout.tsx`, restructure pages: `app/page.tsx` (redirect → `/knowledge`), `app/knowledge/page.tsx`, `app/rfp/page.tsx`, `app/answers/page.tsx` (placeholders this task; filled in Tasks 7–8)

**Interfaces:**
- Produces: `<PublicShell step={1|2|3}>` wrapper — slim top bar (logo → `NEXT_PUBLIC_MARKETING_URL`, `StepNav`, Google sign-in button slot) used by all three pages.
- Consumes: `useGuestSession` (mounts once in shell so the session exists before any upload).

- [ ] **Step 1: Write `components/StepNav.tsx`**

```tsx
"use client";
import Link from "next/link";

const STEPS = [
  { n: 1, href: "/knowledge", label: "Add knowledge" },
  { n: 2, href: "/rfp", label: "Upload RFP" },
  { n: 3, href: "/answers", label: "Answers" },
];

export default function StepNav({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {STEPS.map((s, i) => (
        <span key={s.n} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <span style={{ color: "var(--fg-5)", fontSize: 11 }}>→</span>}
          <Link href={s.href}
            style={{
              fontFamily: "'Geist Mono', ui-monospace, monospace",
              fontSize: 11.5, padding: "3px 8px", borderRadius: 5,
              fontWeight: s.n === current ? 600 : 500,
              color: s.n === current ? "var(--accent-3)" : "var(--fg-4)",
              background: s.n === current ? "var(--accent-tint)" : "transparent",
            }}>
            {s.n}. {s.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Write `components/PublicShell.tsx`**

```tsx
"use client";
import StepNav from "./StepNav";
import { useGuestSession } from "@/lib/use-session";
import { createContext, useContext } from "react";

const SessionCtx = createContext<{ ready: boolean; orgId: string | null; dealId: string | null }>({
  ready: false, orgId: null, dealId: null,
});
export const useSession = () => useContext(SessionCtx);

export default function PublicShell({ step, children }: { step: 1 | 2 | 3; children: React.ReactNode }) {
  const session = useGuestSession();
  return (
    <SessionCtx.Provider value={session}>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", borderBottom: "1px solid var(--divider)", background: "var(--bg-1, #fff)",
        }}>
          <a href={process.env.NEXT_PUBLIC_MARKETING_URL ?? "/"}
             style={{ fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg)", fontSize: 15 }}>
            Klovered <span style={{ color: "var(--accent)", fontFamily: "'Geist Mono', monospace", fontSize: 11 }}>free</span>
          </a>
          <StepNav current={step} />
          <div id="auth-slot" /> {/* Google button lands here in Task 9 */}
        </header>
        <main className="p-7" style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</main>
        <footer style={{ padding: "14px 20px", fontSize: 11.5, color: "var(--fg-5)", textAlign: "center" }}>
          Your files are private to this session and auto-delete after 48 hours. Sign in to keep them.
        </footer>
      </div>
    </SessionCtx.Provider>
  );
}
```

- [ ] **Step 3: Wire pages** — `app/page.tsx` becomes `redirect("/knowledge")` (import from `next/navigation`); create `app/knowledge/page.tsx`, `app/rfp/page.tsx`, `app/answers/page.tsx`, each rendering `<PublicShell step={n}>` with a placeholder `<h1 className="page-title">`.

- [ ] **Step 4: Verify in browser** — `npm run dev`, open `http://localhost:3100`: redirects to `/knowledge`, shell + step nav render, and (dev tools → Application) a Supabase auth cookie exists; `POST /api/session` returned 200 in the network tab.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: public 3-step shell with guest session bootstrap"
```

---

### Task 7: Step 1 — Knowledge screen (port `KnowledgeView`)

**Files:**
- Create: `components/KnowledgeView.tsx` (ported), `components/StatusBadge.tsx` (copied verbatim from `Propello/components/StatusBadge.tsx`), modify `app/knowledge/page.tsx`

**Interfaces:**
- Consumes: Task 4's `/api/knowledge*` routes (unchanged shapes), `useSession` from PublicShell.
- Produces: working upload → 7-step progress → documents table, plus a "Next → Upload RFP" button that appears once ≥1 doc is `ready`.

- [ ] **Step 1: Copy source components**

```bash
SRC="../Propello"
mkdir -p components
cp "$SRC/components/StatusBadge.tsx" components/
cp "$SRC/app/(app)/knowledge/KnowledgeView.tsx" components/KnowledgeView.tsx
```

- [ ] **Step 2: Apply exactly these edits to the ported `KnowledgeView.tsx`:**
  1. Delete the `cloud` tab: remove `TABS` entry `{ id: "cloud", ... }`, the `CLOUD_PROVIDERS` array, `ProviderTile`, `ProviderMark`, `DriveLogo` usage in tiles, `handleDrivePick`, and the `pickDriveFile` import (`@/lib/google-picker` is not vendored). Keep `DriveLogo` only if `SourceIcon` still references it — simpler: keep `SourceIcon`'s plain-file branch only and delete the drive/web branches.
  2. Remove the `reingest` function and its Retry button (route not vendored); failed docs show Delete only.
  3. The page-header block inside the component stays (it's the screen's header now).
  4. Initial data: the component keeps `initial: KDoc[]` prop; the page passes `[]` and the component calls `refreshList()` on mount:
  ```tsx
  useEffect(() => { refreshList(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);
  ```
  5. Add the step-advance affordance after the documents table:
  ```tsx
  {items.some((d) => d.ingestion_status === "ready") && (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <a href="/rfp" className="btn btn-primary">Next — upload your RFP →</a>
    </div>
  )}
  ```

- [ ] **Step 3: Wire `app/knowledge/page.tsx`**

```tsx
"use client";
import PublicShell, { useSession } from "@/components/PublicShell";
import KnowledgeView from "@/components/KnowledgeView";

export default function KnowledgePage() {
  return (
    <PublicShell step={1}>
      <Inner />
    </PublicShell>
  );
}

function Inner() {
  const { ready } = useSession();
  if (!ready) return <div className="text-sm" style={{ color: "var(--fg-4)" }}>Preparing your private session…</div>;
  return <KnowledgeView initial={[]} />;
}
```

- [ ] **Step 4: Verify with preview tools** — upload a small PDF; expect: 7-step tracker runs to Done, row appears `ready` with page count, Next button appears. Then confirm caps: the 11th upload returns the friendly 403 message.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: step 1 knowledge screen ported from product UI"
```

---

### Task 8: Step 2 — RFP upload + extraction; Step 3 — Answers + export

**Files:**
- Create: `components/RfpUpload.tsx`, `components/AnswersList.tsx`, `components/CitationChips.tsx` (copied verbatim from `Propello/components/CitationChips.tsx`), modify `app/rfp/page.tsx`, `app/answers/page.tsx`

**Interfaces:**
- Consumes: Task 5 APIs (`/api/documents/upload`, `/api/documents/process`, `/api/documents/[id]` for status polling, `/api/answers`, `/api/exports/generate` + download), `useSession` (`dealId`).
- Produces: the complete visitor loop.

- [ ] **Step 1: Copy `CitationChips.tsx`**

```bash
cp "../Propello/components/CitationChips.tsx" components/
```
If it imports app-internal helpers that weren't vendored, copy those too (transitive-closure rule from Task 2).

- [ ] **Step 2: Write `components/RfpUpload.tsx`** — same dropzone pattern as KnowledgeView (reuse its dashed-border styles verbatim), single file, then poll:

```tsx
"use client";
import { useRef, useState, useEffect } from "react";
import { useSession } from "./PublicShell";

const PHASES = [
  { key: "queued",    label: "Queued" },
  { key: "ingest",    label: "Parsing RFP" },
  { key: "extract",   label: "Extracting requirements" },
  { key: "structure", label: "Structuring questions" },
  { key: "generate",  label: "Drafting answers" },
  { key: "completed", label: "Done" },
];

export default function RfpUpload() {
  const { dealId } = useSession();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [doc, setDoc] = useState<{ id: string; status: string; error?: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Resume: if an RFP already exists for this session, pick it up.
  useEffect(() => {
    if (!dealId) return;
    fetch(`/api/answers?deal_id=${dealId}`).then(r => r.json()).then(({ questions }) => {
      if (questions?.length) window.location.href = "/answers";
    });
  }, [dealId]);

  useEffect(() => {
    if (!doc || doc.status === "completed" || doc.status === "failed") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/documents/${doc.id}`);
      if (!r.ok) return;
      const { document } = await r.json();
      setDoc({ id: document.id, status: document.processing_status, error: document.error_message });
      if (document.processing_status === "completed") window.location.href = "/answers";
    }, 2000);
    return () => clearInterval(t);
  }, [doc]);

  async function handleFile(f: File | null) {
    if (!f || !dealId) return;
    setErr(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("deal_id", dealId);
    const up = await fetch("/api/documents/upload", { method: "POST", body: fd });
    const j = await up.json().catch(() => ({}));
    if (!up.ok) { setErr(j.error || "Upload failed"); return; }
    const id = j.document?.id;
    await fetch("/api/documents/process", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: id }),
    });
    setDoc({ id, status: "queued" });
  }

  const phaseIdx = doc ? Math.max(0, PHASES.findIndex(p => doc.status.includes(p.key))) : -1;

  if (doc && doc.status !== "failed") {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div className="text-[13px] font-semibold mb-3" style={{ color: "var(--fg)" }}>
          Processing your RFP — this takes a few minutes
        </div>
        {PHASES.map((p, i) => (
          <div key={p.key} className="text-[12.5px] py-1" style={{
            color: i < phaseIdx ? "var(--fg-3)" : i === phaseIdx ? "var(--fg)" : "var(--fg-5)",
            fontWeight: i === phaseIdx ? 600 : 400,
          }}>
            {i < phaseIdx ? "✓" : i === phaseIdx ? "●" : "○"} {p.label}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
      onClick={() => inputRef.current?.click()}
      style={{
        borderStyle: "dashed", borderWidth: 1,
        borderColor: dragging ? "var(--accent)" : "var(--border-strong)",
        background: dragging ? "var(--accent-tint)" : "var(--bg-2)",
        borderRadius: 6, padding: "48px 20px", textAlign: "center", cursor: "pointer",
      }}>
      <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden"
             onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>Drop your RFP</div>
      <div style={{ fontSize: 12, color: "var(--fg-4)" }}>or <span style={{ color: "var(--accent)", textDecoration: "underline" }}>browse</span></div>
      <div style={{ fontSize: 10.5, color: "var(--fg-5)", fontFamily: "'Geist Mono', monospace", marginTop: 6 }}>
        pdf · docx · max 50mb · one per session
      </div>
      {(err || doc?.error) && (
        <div className="text-[12px] px-3 py-2 rounded mt-3" style={{ color: "var(--err)", background: "var(--err-tint, #fff0f0)" }}>
          {err || doc?.error}
        </div>
      )}
    </div>
  );
}
```
**Note:** confirm the exact `processing_status` values and the `/api/documents/[id]` response shape from the copied route before finalizing `PHASES` matching — align to reality, keep the UI as shown.

- [ ] **Step 3: Write `components/AnswersList.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useSession } from "./PublicShell";
import CitationChips from "./CitationChips";

type Q = {
  id: string; question_text: string; status: string;
  response: { answer_text: string; confidence: number | null; gap_flag: string | null;
              citations: { chunk_id: string; filename: string | null; page_start: number | null }[] } | null;
};

export default function AnswersList() {
  const { dealId, ready } = useSession();
  const [qs, setQs] = useState<Q[] | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!ready || !dealId) return;
    fetch(`/api/answers?deal_id=${dealId}`).then(r => r.json()).then(d => setQs(d.questions ?? []));
  }, [ready, dealId]);

  async function exportDocx() {
    setExporting(true);
    const r = await fetch("/api/exports/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, format: "docx", citation_style: "inline" }),
    });
    const j = await r.json().catch(() => ({}));
    setExporting(false);
    if (j.export_id ?? j.id) window.location.href = `/api/exports/${j.export_id ?? j.id}/download`;
  }

  if (!qs) return <div className="text-sm" style={{ color: "var(--fg-4)" }}>Loading answers…</div>;
  if (qs.length === 0)
    return <div className="text-sm" style={{ color: "var(--fg-4)" }}>No RFP processed yet. <a href="/rfp" style={{ color: "var(--accent)" }}>Upload one →</a></div>;

  return (
    <div className="space-y-4">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="page-meta">{qs.length} requirements · {qs.filter(q => q.response).length} drafted</span>
        <button className="btn btn-primary" onClick={exportDocx} disabled={exporting}>
          {exporting ? "Exporting…" : "Export .docx"}
        </button>
      </div>
      {qs.map((q, i) => (
        <div key={q.id} className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-5)" }}>{String(i + 1).padStart(2, "0")}</span>
            <div style={{ flex: 1 }}>
              <div className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>{q.question_text}</div>
              {q.response ? (
                <>
                  <p className="text-[13px] mt-2" style={{ color: "var(--fg-2)", whiteSpace: "pre-wrap" }}>{q.response.answer_text}</p>
                  <div className="mt-2" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    {q.response.confidence != null && (
                      <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>conf {q.response.confidence.toFixed(1)}</span>
                    )}
                    {q.response.gap_flag === "no_source" && <span className="status err">no source</span>}
                    <CitationChips citations={q.response.citations as any} />
                  </div>
                </>
              ) : (
                <div className="text-[12px] mt-2" style={{ color: "var(--fg-4)" }}>Drafting…</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```
**Note:** adapt the `CitationChips` props to the copied component's actual prop type (read it after copying; map `{filename, page_start}` into whatever it renders).

- [ ] **Step 4: Wire pages** — `app/rfp/page.tsx` renders `<PublicShell step={2}><RfpUpload/></PublicShell>` (client page, same pattern as Task 7 Step 3 with a session-ready guard); `app/answers/page.tsx` renders `<PublicShell step={3}><AnswersList/></PublicShell>`.

- [ ] **Step 5: End-to-end verify with preview tools** — full loop with a real small KB doc + small RFP: upload knowledge → upload RFP → watch phases → answers render with citations → export downloads a `.docx` that opens. This is the release gate for the core loop.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: RFP upload/extraction and answers screens complete the loop"
```

---

### Task 9: Google sign-in (keep your data) 

**Files:**
- Create: `components/AuthButton.tsx`, `app/api/auth/callback/route.ts` (copied from `Propello/app/api/auth/callback/route.ts`)
- Modify: `components/PublicShell.tsx` (replace `#auth-slot` div with `<AuthButton />`)

**Interfaces:**
- Consumes: Supabase `linkIdentity`; existing Google provider config in the shared Supabase project.
- Produces: anonymous user upgraded **in place** (same org, same data); signed-in state shown in header; signed-in orgs exempt from cleanup (Task 10 checks `is_anonymous`).

- [ ] **Step 1: Copy the callback route**

```bash
mkdir -p app/api/auth/callback
cp "../Propello/app/api/auth/callback/route.ts" app/api/auth/callback/
```
Read it after copying; if it redirects to product paths (e.g. `/deals`), change the success redirect to `/answers`.

- [ ] **Step 2: Write `components/AuthButton.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [anon, setAnon] = useState(true);

  useEffect(() => {
    createClient().auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? null);
      setAnon(session?.user?.is_anonymous ?? true);
    });
  }, []);

  async function signIn() {
    const supabase = createClient();
    await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=/answers` },
    });
  }

  if (!anon && email) {
    return <span className="mono" style={{ fontSize: 11, color: "var(--fg-4)" }}>{email} · saved</span>;
  }
  return (
    <button className="btn" onClick={signIn} style={{ fontSize: 12 }}>
      Sign in with Google to keep your work
    </button>
  );
}
```
**Note:** `linkIdentity` on an already-linked user errors — if the session is not anonymous, the button isn't shown, which covers it.

- [ ] **Step 3: Verify** — click the button, complete Google OAuth, land back on `/answers` with data intact (same org). Confirm in Supabase dashboard that the user row now has a Google identity and `is_anonymous=false`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Google sign-in upgrades guest session in place"
```

---

### Task 10: Guest cleanup (48 h expiry)

**Files:**
- Create: `app/api/cron/cleanup/route.ts`, `scripts/cleanup.mjs` (manual trigger)

**Interfaces:**
- Consumes: admin client; `CRON_SECRET` header gate (same convention as `jobs/drain`).
- Produces: `POST /api/cron/cleanup` deletes guest orgs older than 48 h whose members are all still anonymous: storage objects under `knowledge/<org_id>/`, then the org row (FK cascades cover children — verify, else delete children explicitly in the order chunks → citations → responses → questions → documents → knowledge_documents → deals → team_members → org_settings → organizations), and finally `auth.admin.deleteUser` for each anonymous member.

- [ ] **Step 1: Write `app/api/cron/cleanup/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  const { data: orgs } = await admin
    .from("organizations").select("id, slug, created_at")
    .like("slug", "guest-%").lt("created_at", cutoff);

  let purged = 0;
  for (const org of orgs ?? []) {
    const { data: members } = await admin
      .from("team_members").select("user_id").eq("org_id", org.id);

    // Exempt orgs where any member upgraded to a real (Google) account.
    let allAnonymous = true;
    for (const m of members ?? []) {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (data?.user && !(data.user as any).is_anonymous) { allAnonymous = false; break; }
    }
    if (!allAnonymous) continue;

    // Storage first (no cascade covers it).
    const { data: objects } = await admin.storage.from("knowledge").list(org.id, { limit: 1000 });
    if (objects?.length)
      await admin.storage.from("knowledge").remove(objects.map(o => `${org.id}/${o.name}`));

    await admin.from("organizations").delete().eq("id", org.id); // rely on FK cascade — verified in Step 2
    for (const m of members ?? []) await admin.auth.admin.deleteUser(m.user_id).catch(() => {});
    purged++;
  }
  return NextResponse.json({ ok: true, purged });
}
```

- [ ] **Step 2: Verify cascade coverage** — in Supabase SQL editor:

```sql
select conname, confdeltype from pg_constraint
where confrelid = 'organizations'::regclass;
```
`confdeltype = 'c'` means cascade. If any child FK is not `c` (e.g. `documents` hangs off `deals`), add explicit child deletes to the route in dependency order before the org delete (order listed in Interfaces above).

- [ ] **Step 3: Write `scripts/cleanup.mjs`** (manual/CI trigger):

```js
const res = await fetch(`${process.env.SITE_URL ?? "http://localhost:3100"}/api/cron/cleanup`, {
  method: "POST", headers: { "x-cron-secret": process.env.CRON_SECRET },
});
console.log(await res.json());
```

- [ ] **Step 4: Test with a synthetic stale org** — via SQL editor, backdate one throwaway guest org: `update organizations set created_at = now() - interval '3 days' where slug = 'guest-<test one>';` then run the script; expect `{ ok: true, purged: 1 }` and the org, its rows, storage objects, and anon user gone. Repeat with a Google-upgraded session's org: expect it survives.

- [ ] **Step 5: Commit** (also note in README that a scheduler — pg_cron/GitHub Action/Vercel cron — must POST this endpoint hourly; wiring the scheduler is deploy-time, not code).

```bash
git add -A && git commit -m "feat: 48h guest data expiry with signed-in exemption"
```

---

### Task 11: Hardening pass + README + landing link

**Files:**
- Create: `README.md`
- Modify: none in `klovered-free` beyond fixes found; one env note for `klovered-landing-human`

- [ ] **Step 1: Re-run the isolation check from Task 3 Step 4** against the finished app (now with real uploads in both sessions). Expected: still zero cross-org visibility, including `/api/answers` with the other session's `deal_id` (returns `{ questions: [] }`).

- [ ] **Step 2: Verify guardrails end-to-end** — 11th doc → 403 message; 2nd RFP → 403 message; hammer `/api/session` >10×/hr from one IP → 429.

- [ ] **Step 2b (optional hardening — ASK THE USER first, it adds RLS policies to the shared project):** anonymous users hold valid sessions against the shared Supabase project, so they could in principle exercise main-product surfaces (team invites, templates) inside their own throwaway org. Supabase's documented pattern is a **restrictive** policy keyed on the JWT claim, e.g.:

```sql
create policy "Only permanent users can invite team members"
on team_invites as restrictive for insert
to authenticated
with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);
```

If the user approves, apply the same restrictive pattern to `team_invites` (and any other invite/admin tables they choose). This is the only step in the plan that touches the shared project's policies; skipping it is acceptable for launch since guests only ever see their own org.

- [ ] **Step 3: Write `README.md`** — what this app is (GTM free tool), env vars table, the two manual Supabase toggles (anonymous sign-ins, Google provider redirect URL for this domain), the cleanup scheduler requirement, and the model split note (spec §9).

- [ ] **Step 4: Landing link** — in `klovered-landing-human`, the CTAs already use `NEXT_PUBLIC_APP_URL`. Decide with the user: either point that env at the free tool's deploy URL, or add a separate `NEXT_PUBLIC_FREE_TOOL_URL` + a "Try it free — no sign-up" CTA. **Ask the user before touching the landing repo.**

- [ ] **Step 5: Full-loop regression with preview tools** (knowledge → RFP → answers → export → Google sign-in), then commit:

```bash
git add -A && git commit -m "docs: README, hardening verification for public launch"
```

---

## Self-Review (done at write time)

- **Spec coverage:** §2 in-scope items → Tasks 4–9; §3 landing reuse → Task 11 Step 4 (no landing built); §4 repo layout → Tasks 1–2; §5 anon auth + isolation → Task 3 (+ re-check Task 11); §6 screens/reuse → Tasks 6–8; §7 guardrails → Tasks 4, 5, 10, 11; §8 backend reuse → Task 2 (copy-only rule); §9 model split → recorded in spec; execution now proceeds on the user's currently selected model.
- **Known verify-against-reality points (flagged inline, not placeholders):** answers nested-select column names (Task 5 Step 3), `processing_status` phase values (Task 8 Step 2), `CitationChips` prop shape (Task 8 Step 3), auth-callback redirect (Task 9 Step 1), FK cascade coverage (Task 10 Step 2). Each has an explicit verification step and a defined fallback.
- **Type consistency:** `useGuestSession`/`useSession` → `{ ready, orgId, dealId }` used consistently in Tasks 6–8; `requireGuest()` → `{ user, supabase, member }` used in Tasks 4–5; API shapes match what the ported `KnowledgeView` already expects.
