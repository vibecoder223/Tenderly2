# Tenderly — RFP Response Platform

AI-powered RFP automation. Real Supabase persistence, real Claude agent pipeline (optional).

## Run it

```bash
# 1. Apply the schema. Easiest path: open Supabase Studio → SQL Editor →
#    paste contents of migrations/0001_init.sql → run.
#    (Or: set SUPABASE_DB_URL in .env.local and `npm install --no-save pg && npm run db:migrate`)

# 2. Start
npm run dev
# open http://localhost:3000 → sign up → create workspace → upload an RFP
```

## What works today (with just the publishable key + schema applied)

Every action persists to Supabase. No mock data.

- **Auth** — email/password sign-up, sign-in, sign-out
- **Onboarding** — workspace creation (uses RLS-permitted user-context inserts)
- **Deals** — create, list, dashboard with pipeline stats
- **RFP upload** — drag-drop PDF/DOCX/TXT to Supabase Storage; the file is real, the row is real
- **Manual question entry** — add requirements/questions by hand on the triage page (works without LLM)
- **SME workspace** — assign, draft, submit responses
- **Review** — approve/reject responses
- **Export** — real PDF generation via `pdfkit`, stored to Storage, downloadable
- **Response library** — save and reuse templates
- **Analytics** — pipeline value, win rate, token usage
- **Team / Settings** — view team, configure defaults

## What needs more keys

| Feature | Needs |
| --- | --- |
| AI requirement extraction from uploaded RFP | `ANTHROPIC_API_KEY` |
| AI draft response generation | `ANTHROPIC_API_KEY` |
| "Regenerate with Claude" in SME workspace | `ANTHROPIC_API_KEY` |
| Programmatic schema migration via `npm run db:migrate` | `SUPABASE_DB_URL` |
| Bypass-RLS admin operations (optimization, not required) | `SUPABASE_SERVICE_ROLE_KEY` |

When `ANTHROPIC_API_KEY` is missing, the upload still succeeds and the file is stored — the document page shows a clear "API key not configured" message instead of failing silently or pretending to work. You can still add questions manually and test the whole SME → Review → Export flow.

## Tech

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth + Storage) with full RLS
- `@anthropic-ai/sdk` against `claude-sonnet-4-6` (when key is present)
- `pdf-parse`, `mammoth` for ingestion; `pdfkit` for export

## Project layout

```
app/
  auth/                 # login, signup, onboarding (public)
  (app)/                # protected app shell
    dashboard/
    deals/              # list, new, [id], /triage, /sme, /review, /export
    library/  analytics/  team/  settings/
  api/                  # all real backend routes
components/             # Sidebar, Topbar, StatusBadge
lib/
  agents.ts             # full agent pipeline
  anthropic.ts          # Claude client + cost telemetry
  extract.ts            # pdf-parse / mammoth wrappers
utils/
  supabase/{server,client,middleware,admin}.ts
  auth.ts
migrations/0001_init.sql
```

## Environment

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…

# Optional — unlocks the AI pipeline
ANTHROPIC_API_KEY=

# Optional — unlocks `npm run db:migrate` (otherwise paste SQL into Supabase Studio)
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres

# Optional — admin operations (slug uniqueness, etc.). Falls back gracefully.
SUPABASE_SERVICE_ROLE_KEY=
```
