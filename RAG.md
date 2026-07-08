# Tenderly — RAG Pipeline (as built)

**Status:** ingestion, retrieval, citation-grounded generation, gap
detection, and `.docx` export are in place. The pipeline runs on Mistral
via the OpenAI-compatible client in `lib/mistral.ts` (`MISTRAL_API_KEY`,
with Mistral embeddings for retrieval). Without a key the system
gracefully degrades to clear no-source / AI-disabled responses rather
than hallucinating.

## Pipeline diagram

```
┌──────────────────────────────────────────┐    ┌─────────────────────────────┐
│ Knowledge-base uploads                   │    │ RFP upload                  │
│ (POST /api/knowledge/upload)             │    │ (POST /api/documents/upload)│
└──────────┬───────────────────────────────┘    └──────────┬──────────────────┘
           │                                               │
           ▼                                               ▼
   lib/parse.ts  (pdfjs / mammoth)                lib/parse.ts (pdfjs / mammoth)
           │  blocks with page + section                   │  same
           ▼                                               ▼
   lib/chunk.ts  (400–600 tok, header-aware)      lib/chunk.ts (same)
           │                                               │
           ▼                                               ▼
   lib/embeddings.ts  voyage-3-large 1024d        lib/embeddings.ts (RFP-side too)
           │                                               │
           ▼                                               ▼
   document_chunks  (pgvector + sparse_terms[])   document_chunks (same table)
           │
           │           ┌──────────────────────────┐
           │           │ RFP requirement extraction│
           │           │ Claude Sonnet 4.6 + zod   │
           │           │ (lib/agents.ts)           │
           │           └────────────┬──────────────┘
           │                        ▼
           │                 extracted_requirements
           │                        │
           │                        ▼
           │                    questions
           │                        │
           │                        ▼
           │         ┌────────────────────────────┐
           └────────►│ retrieval (lib/retrieval.ts)│
                     │   • Haiku query expansion  │
                     │   • dense (pgvector RPC)   │
                     │   • sparse (BM25, GIN)     │
                     │   • Voyage rerank-2        │
                     │   • top-6, threshold 0.40  │
                     └────────────┬───────────────┘
                                  ▼
                     ┌────────────────────────────┐
                     │ generation (lib/rag.ts)    │
                     │   • Sonnet 4.6 grounded    │
                     │   • [c:UUID] markers       │
                     │   • parses → citations[]   │
                     │   • Haiku confidence pass  │
                     └────────────┬───────────────┘
                                  ▼
                      responses + citations
                                  │
                                  ▼
                     ┌────────────────────────────┐
                     │ export (lib/docx-export.ts)│
                     │   • `.docx` via `docx` pkg │
                     │   • PDF fallback           │
                     │   • inline / footnotes     │
                     └────────────────────────────┘
```

## Stack as built

| Layer | Choice | File / Service |
|---|---|---|
| Backend | TypeScript / Next.js 14 (App Router) | `app/api/**/route.ts` |
| Parser | `pdfjs-dist` (PDF, page-aware) + `mammoth` (DOCX) | [lib/parse.ts](lib/parse.ts) |
| Chunker | Token-aware, never splits mid-paragraph or mid-list | [lib/chunk.ts](lib/chunk.ts) |
| Embeddings | Voyage `voyage-3-large` (1024d), batch 64 | [lib/embeddings.ts](lib/embeddings.ts) |
| Vector store | `pgvector` ivfflat on `document_chunks.embedding` | [migrations/0002_rag.sql](migrations/0002_rag.sql) |
| Sparse | `text[] sparse_terms` + Postgres GIN + in-memory BM25 | [lib/retrieval.ts](lib/retrieval.ts) `sparseSearch()` |
| Re-ranker | Voyage `rerank-2`, top-6 | [lib/embeddings.ts](lib/embeddings.ts) `rerank()` |
| Generation | Claude Sonnet 4.6, grounded prompt with `[c:UUID]` markers | [lib/rag.ts](lib/rag.ts) |
| Confidence | Claude Haiku 4.5, 0.0–1.0 single-decimal score | [lib/rag.ts](lib/rag.ts) `generateAndPersistAnswer()` |
| Export | `.docx` via `docx` npm pkg, PDF via `pdfkit` | [lib/docx-export.ts](lib/docx-export.ts), [app/api/exports/generate/route.ts](app/api/exports/generate/route.ts) |
| Eval | `evals/rag_eval.jsonl` (30 cases, 5 no-source) + `npm run eval` | [scripts/eval.mjs](scripts/eval.mjs) |

## Data model deltas (M1 migration)

Added by [migrations/0002_rag.sql](migrations/0002_rag.sql):

- `knowledge_documents` — new table, RLS-scoped per org, status machine.
- `document_chunks` extended: `embedding vector(1024)`, `sparse_terms text[]`,
  `page_start`, `page_end`, `section_path`, `text_for_embedding`,
  `knowledge_document_id` (so the same table serves KB + RFP chunks),
  `org_id`. Indexes: ivfflat on embedding, GIN on sparse_terms.
- `citations` — new table, one row per `[c:UUID]` marker. References
  `responses` and `document_chunks`.
- `extracted_requirements` extended: `section`, `source_page`,
  `classification` (`must|should|info`), `topic` (`security|legal|...`).
- `responses` extended: `answer_text_with_markers`, `confidence`,
  `gap_flag` (`ok|partial|no_source`), `generated_by`. `status` enum grows
  to include `requires_review`.
- Storage bucket `knowledge` with org-scoped RLS policies.
- RPC `match_chunks(p_org_id, p_embedding, p_match_count)` for dense
  retrieval inside Postgres.

## Prompts (version-tagged)

### `generator_system_v1`
```
You are a proposal writer at the customer's company. You write answers to
RFP requirements in the customer's own voice, drawing exclusively from the
source chunks provided. You never invent facts. You never speculate. You
never use external knowledge.

Rules:
1. Every factual claim must be supported by a chunk in <sources>. If a
   claim is not supported, do not make it.
2. Cite every supported claim inline using [c:CHUNK_ID]. The exact UUID
   from <sources>, no quotes, no extra brackets.
3. Write in business prose: confident, specific, concise. If voice
   examples are provided, match their tone.
4. If sources contradict each other, prefer the more recent document and
   note the discrepancy in a closing sentence.
5. If the sources do not cover the requirement, output exactly:
   "NO_SOURCE: The knowledge base does not contain content sufficient to
   answer this requirement."
   Do not draft a partial or hedged answer.
6. Length: match the requirement. "Describe" gets 100-200 words.
   "Confirm" gets one sentence. Do not pad.
```

### `confidence_system_v1`
```
Score this answer's grounding 0.0-1.0.

- 1.0: every claim is directly supported by a cited chunk.
- 0.7: mostly supported; minor unsupported phrasing.
- 0.4: partially supported; weak source coverage on some claims.
- 0.0: not grounded.

Output a single decimal number, nothing else.
```

### Requirement extraction system (`extractor_v1`)
Defined inline in [lib/agents.ts](lib/agents.ts) `runExtractionAgent`.
Asks for a JSON array conforming to the zod schema
`RequirementSchema = { requirement_id, section, text, classification, topic, source_page }`.
Validation uses zod; on schema failure, retried up to 3 times with the
prior error appended; persistent failures skip that chunk rather than
fail the whole run.

### Query expansion (`expander_v1`)
Defined inline in [lib/retrieval.ts](lib/retrieval.ts). Asks Haiku for a
JSON `{ paraphrases: [2], keywords: [5] }`. Failure is non-fatal — falls
back to the bare query and naive tokenization.

## API surface (final)

Existing routes preserved (unchanged):
`/api/onboarding`, `/api/deals`, `/api/documents/upload`,
`/api/documents/process`, `/api/questions`, `/api/questions/[id]/{respond,assign,regenerate}`,
`/api/responses/[id]/approve`, `/api/exports/[id]/download`,
`/api/library`, `/api/settings`, `/api/auth/signout`.

New routes (M2):
- `POST /api/knowledge/upload` — multipart upload + sync ingestion.
- `GET  /api/knowledge` — list workspace's KB documents.
- `DELETE /api/knowledge/[id]` — purge document + chunks.

Existing route changed surface-compatibly (M6):
- `POST /api/exports/generate` now accepts `{ format?: "pdf" | "docx",
  citation_style?: "inline" | "footnote" }`. Default is `pdf`/`inline`
  so the existing UI keeps working unchanged.

## Eval

`evals/rag_eval.jsonl` — 30 cases, 5 of which expect `NO_SOURCE`.
Each entry has `requirement`, `expected_citations` (as `"filename p.NN"`),
`must_mention`, `must_not_mention`, and optionally `expected_no_source`.

`npm run eval` runs every case against the live DB, prints the four
metrics, and writes a timestamped JSON report under `evals/results/`.

**Latest run:** *not yet executed in production* — requires an LLM key
(`MISTRAL_API_KEY` / `LLM_API_KEY`) to be set, and a populated
knowledge base. The harness is built and ready; run it after seeding the
KB with the actual documents referenced in `expected_citations`. To run:

```bash
npm run eval -- --org-id <UUID>
```

## What's untouched in the frontend

Per the spec's hard rule, no frontend code was rewritten. Two minor
additions:

1. [ExportControls.tsx](app/(app)/deals/[id]/export/ExportControls.tsx)
   gained a citation-style selector + a `.docx` button. PDF path is
   preserved.
2. Existing pages render unchanged — the new `confidence`, `gap_flag`,
   and `citations` fields land in the database and stay invisible to the
   user until the SME/Review UIs are extended to surface them. That UI
   change is **flagged for separate sign-off** (item §7-3 in
   [BACKEND_AUDIT.md](BACKEND_AUDIT.md)).

## Definition of done — status

| Criterion | Status |
|---|---|
| 50-page KB PDF ingested in ≤60s | Architecturally yes; pending live measurement once Voyage key is set. |
| 200-requirement RFP drafts in ≤5min with ≥80% conf≥0.7 | Pending live measurement. |
| Citation accuracy ≥85% | Pending eval run with real corpus. |
| Gap detection 100% on no-source cases | The retrieval-side threshold (`< 0.40`) plus the prompt's `NO_SOURCE` sentinel are both wired. Confirmed via code path; pending eval run. |
| `.docx` opens cleanly in Word + Google Docs | `docx` library produces standards-compliant `.docx`; should open in both. Manual check pending once a real run produces a file. |
| Frontend works against new backend without UI changes | Yes — verified locally that login → dashboard → deal → triage all still render. |
| Total API spend per RFP run <$2 | Architecturally plausible (200 reqs × ~$0.008/req for Sonnet + cheap Haiku scoring + Voyage at fractional cents). Confirm at first real run. |

## Three things I'd improve next given another week

1. **Stream-friendly chunk-level retrieval cache.** Right now retrieval
   embeds each requirement's query independently. With 200 requirements,
   that's 200 Voyage round-trips. Batching paraphrases per RFP (a single
   batch of 600 vectors) cuts retrieval wall time by ~5×.
2. **A real "no source" UI affordance.** The data layer now flags
   `gap_flag = no_source` and surfaces it in `.docx` as red italic
   text. The SME workspace should make these requirements jump out —
   they're the ones a human must address before submission.
3. **Connector for one cloud drive.** Per the landing page, customers
   expect SharePoint / Google Drive ingestion. The cleanest single-vendor
   choice is Google Drive via the picker; one OAuth scope and a
   per-folder webhook keeps the KB synced. Out of scope for this build,
   but the `knowledge_documents.source_url` field is already there for
   it.
