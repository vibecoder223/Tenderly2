#!/usr/bin/env node
/**
 * Cross-tenant isolation test.
 *
 * Spins up two orgs + two users, seeds deal/document/question/response data
 * in each org, then signs in as user A and tries every imaginable cross-org
 * read/write against user B's resources. Every cross-org attempt must fail.
 *
 * Cleans up after itself unless KEEP_TEST_DATA=1 is set.
 *
 * Usage: node scripts/test-isolation.mjs
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = await loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) fail("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local.");

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const stamp = Date.now();
const orgs = [];
const users = [];
const deals = [];
const docs = [];
const questions = [];

let passed = 0;
let failed = 0;

try {
  await setup();
  await runTests();
} finally {
  if (env.KEEP_TEST_DATA !== "1") {
    await cleanup();
  } else {
    console.log("[keep] left test data in place");
  }
}

console.log(`\n${failed === 0 ? "✓" : "✗"} ${passed} pass / ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);

// ============================================================
async function setup() {
  for (const tag of ["a", "b"]) {
    const email = `iso-${tag}-${stamp}@tenderly.test`;
    const password = `Iso!Test!${stamp}-${tag}`;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: `Iso ${tag.toUpperCase()}` },
    });
    if (cErr) fail(`createUser ${tag}: ${cErr.message}`);
    const user = created.user;

    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `Iso Org ${tag.toUpperCase()} ${stamp}`, slug: `iso-${tag}-${stamp}` })
      .select()
      .single();

    await admin.from("team_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      email,
      name: `Iso ${tag.toUpperCase()}`,
    });

    const { data: deal } = await admin
      .from("deals")
      .insert({
        org_id: org.id,
        name: `Iso Deal ${tag.toUpperCase()}`,
        owner_id: user.id,
        status: "new",
      })
      .select()
      .single();

    const { data: doc } = await admin
      .from("documents")
      .insert({
        deal_id: deal.id,
        filename: `iso-${tag}.txt`,
        file_path: `${deal.id}/iso-${tag}.txt`,
        processing_status: "uploaded",
      })
      .select()
      .single();

    const { data: q } = await admin
      .from("questions")
      .insert({
        document_id: doc.id,
        requirement_id: `ISO-${tag.toUpperCase()}-1`,
        question_text: `Secret question for org ${tag.toUpperCase()}`,
        status: "unanswered",
      })
      .select()
      .single();

    // A response + a citation chunk
    const { data: chunk } = await admin
      .from("document_chunks")
      .insert({
        document_id: doc.id,
        org_id: org.id,
        chunk_index: 0,
        raw_text: `confidential org ${tag} chunk`,
        cleaned_text: `confidential org ${tag} chunk`,
      })
      .select()
      .single();

    const { data: response } = await admin
      .from("responses")
      .insert({
        question_id: q.id,
        draft_text: `private draft for org ${tag}`,
        status: "draft",
      })
      .select()
      .single();

    await admin.from("citations").insert({
      response_id: response.id,
      chunk_id: chunk.id,
      document_filename: doc.filename,
      page: 1,
      quote: `secret quote ${tag}`,
    });

    users.push({ email, password, id: user.id, tag });
    orgs.push(org);
    deals.push(deal);
    docs.push({ ...doc, chunk_id: chunk.id, response_id: response.id });
    questions.push(q);
  }
  console.log(`[setup] org A=${orgs[0].id} user=${users[0].id}`);
  console.log(`[setup] org B=${orgs[1].id} user=${users[1].id}`);
}

async function runTests() {
  // Sign in as user A; everything below must NOT leak org B data.
  const A = createClient(URL, ANON);
  const { data: signA, error: signErr } = await A.auth.signInWithPassword({
    email: users[0].email,
    password: users[0].password,
  });
  if (signErr) fail(`signIn A: ${signErr.message}`);
  console.log(`[auth] signed in as user A (${signA.user?.id})`);

  const dealB = deals[1].id;
  const docB = docs[1].id;
  const qB = questions[1].id;
  const respB = docs[1].response_id;
  const chunkB = docs[1].chunk_id;
  const orgB = orgs[1].id;

  await expectEmpty(A.from("deals").select("*").eq("id", dealB), "user A cannot read org B deal");
  await expectEmpty(A.from("documents").select("*").eq("id", docB), "user A cannot read org B document");
  await expectEmpty(A.from("questions").select("*").eq("id", qB), "user A cannot read org B question");
  await expectEmpty(A.from("responses").select("*").eq("id", respB), "user A cannot read org B response");
  await expectEmpty(A.from("document_chunks").select("*").eq("id", chunkB), "user A cannot read org B chunk");
  await expectEmpty(A.from("citations").select("*").eq("response_id", respB), "user A cannot read org B citations");
  await expectEmpty(A.from("extracted_requirements").select("*").eq("document_id", docB), "user A cannot read org B requirements");
  await expectEmpty(A.from("compliance_matrix").select("*").eq("document_id", docB), "user A cannot read org B compliance");
  await expectEmpty(A.from("agent_runs").select("*").eq("document_id", docB), "user A cannot read org B agent runs");
  await expectEmpty(A.from("response_library").select("*").eq("org_id", orgB), "user A cannot read org B reusable answers");
  await expectEmpty(A.from("activity_log").select("*").eq("org_id", orgB), "user A cannot read org B activity");
  await expectEmpty(A.from("exports").select("*").eq("deal_id", dealB), "user A cannot read org B exports");
  await expectEmpty(A.from("org_settings").select("*").eq("org_id", orgB), "user A cannot read org B settings");
  await expectEmpty(A.from("knowledge_documents").select("*").eq("org_id", orgB), "user A cannot read org B knowledge docs");
  await expectEmpty(A.from("team_members").select("*").eq("org_id", orgB), "user A cannot read org B team members");
  await expectEmpty(A.from("invites").select("*").eq("org_id", orgB), "user A cannot read org B invites");

  // Even reading organizations directly — A is not a member of B
  await expectEmpty(A.from("organizations").select("*").eq("id", orgB), "user A cannot read org B organization row");

  // Cross-org WRITES should all fail
  await expectInsertBlocked(
    A.from("deals").insert({ org_id: orgB, name: "Stolen", status: "new" }),
    "user A cannot insert deal into org B"
  );
  await expectInsertBlocked(
    A.from("questions").insert({ document_id: docB, question_text: "x", status: "unanswered" }),
    "user A cannot insert question into org B document"
  );
  await expectInsertBlocked(
    A.from("responses").insert({ question_id: qB, draft_text: "x", status: "draft" }),
    "user A cannot insert response into org B question"
  );
  await expectInsertBlocked(
    A.from("question_comments").insert({ question_id: qB, body: "leak" }),
    "user A cannot comment on org B question"
  );
  await expectInsertBlocked(
    A.from("knowledge_documents").insert({
      org_id: orgB,
      filename: "x.pdf",
      file_path: `${orgB}/x.pdf`,
      doc_type: "other",
      ingestion_status: "pending",
    }),
    "user A cannot insert KB doc into org B"
  );
  await expectInsertBlocked(
    A.from("invites").insert({
      org_id: orgB,
      email: "bad@test.com",
      token: `bad-${stamp}`,
    }),
    "user A cannot create invite into org B"
  );

  // Updates / deletes
  await expectUpdateAffectedRows(
    A.from("deals").update({ name: "rewritten" }).eq("id", dealB),
    0,
    "user A cannot rename org B deal"
  );
  await expectUpdateAffectedRows(
    A.from("responses").update({ final_text: "stolen", status: "approved" }).eq("id", respB),
    0,
    "user A cannot approve org B response"
  );
  await expectUpdateAffectedRows(
    A.from("documents").delete().eq("id", docB),
    0,
    "user A cannot delete org B document"
  );

  // Sanity: user A CAN see their own data
  await expectNonEmpty(A.from("deals").select("*").eq("id", deals[0].id), "user A sees own deal");
  await expectNonEmpty(A.from("questions").select("*").eq("id", questions[0].id), "user A sees own question");

  // And user A's session shouldn't be able to forge a team_members row claiming org B
  await expectInsertBlocked(
    A.from("team_members").insert({ org_id: orgB, user_id: users[0].id, role: "viewer", email: users[0].email }),
    "user A cannot self-add to org B as member"
  );

  await A.auth.signOut();
}

async function cleanup() {
  for (const u of users) {
    await admin.auth.admin.deleteUser(u.id);
  }
  for (const o of orgs) {
    await admin.from("organizations").delete().eq("id", o.id);
  }
  console.log("[cleanup] removed test users + orgs");
}

// ============================================================

async function expectEmpty(query, label) {
  const { data, error } = await query;
  const rows = data ?? [];
  if (error && error.code !== "PGRST116") {
    // PostgREST returns no error for a filtered empty result. Other errors (e.g. permission denied)
    // are also acceptable evidence of isolation.
    return record(true, `${label}  →  ${error.code ?? error.message}`);
  }
  return record(rows.length === 0, `${label}  →  rows=${rows.length}`);
}

async function expectNonEmpty(query, label) {
  const { data } = await query;
  const rows = data ?? [];
  return record(rows.length > 0, `${label}  →  rows=${rows.length}`);
}

async function expectInsertBlocked(query, label) {
  const { data, error } = await query.select();
  // Pass if Postgres rejected (RLS violation) or returned no rows.
  const rejected = !!error || !data || data.length === 0;
  return record(rejected, `${label}  →  ${error?.code ?? "rows=" + (data?.length ?? 0)}`);
}

async function expectUpdateAffectedRows(query, expected, label) {
  const { data, error } = await query.select();
  if (error) return record(true, `${label}  →  ${error.code}`);
  const rows = data ?? [];
  return record(rows.length === expected, `${label}  →  rows=${rows.length}`);
}

function record(ok, msg) {
  if (ok) {
    passed += 1;
    console.log("  ✓", msg);
  } else {
    failed += 1;
    console.log("  ✗", msg);
  }
}

// ============================================================
async function loadEnv() {
  const out = { ...process.env };
  try {
    const txt = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
  return out;
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}
