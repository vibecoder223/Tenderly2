#!/usr/bin/env node
// Apply SQL migrations to Supabase by hitting the PostgREST RPC `query` is unavailable,
// so we use the pg_meta-style HTTP endpoint via the service_role key + plain pg over the
// pooler. We use a raw HTTPS request to the SQL endpoint exposed by Supabase Studio
// (`/pg/query`) which accepts service_role JWT.
//
// Strategy: use the supabase-js `rpc("exec_sql")`? Not built in. Instead we POST to the
// hidden `/rest/v1/rpc/...` if available, OR fall back to splitting SQL and posting via
// pg's HTTP relay (`pg-meta` is internal). Reliable path: use the `pg` package — but we
// want zero extra deps for the migrate script. So we shell out to `psql` if available,
// otherwise we use Supabase's REST `query` endpoint at https://<ref>.supabase.co/pg/...
// which requires the management API token.
//
// Simplest robust approach: use `@supabase/supabase-js` admin to read, but for DDL we
// rely on the SQL HTTP endpoint at `https://api.supabase.com/v1/projects/<ref>/database/query`
// which needs a management API access token (different from service_role).
//
// Since user gave service_role, the most portable approach is to connect via the
// Postgres connection string. We require SUPABASE_DB_URL OR derive a pooled URL.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const env = await loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = env.SUPABASE_DB_URL;

if (!SUPABASE_URL) fail("NEXT_PUBLIC_SUPABASE_URL missing");
if (!SERVICE_KEY && !DB_URL) fail("Provide SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_URL");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "migrations");
const files = (await readdirSorted(migrationsDir)).filter((f) => f.endsWith(".sql"));

if (files.length === 0) {
  console.log("No migrations found.");
  process.exit(0);
}

const sql = (await Promise.all(
  files.map((f) => readFile(path.join(migrationsDir, f), "utf8"))
)).join("\n\n");

console.log(`→ Applying ${files.length} migration file(s): ${files.join(", ")}`);

if (DB_URL) {
  await runViaPg(DB_URL, sql);
} else {
  await runViaPg(buildDbUrlFromService(SUPABASE_URL, SERVICE_KEY), sql);
}

console.log("✓ Migrations applied.");

// ---------- helpers ----------

async function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  try {
    const txt = await readFile(envPath, "utf8");
    const out = { ...process.env };
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
    return out;
  } catch {
    return { ...process.env };
  }
}

async function readdirSorted(dir) {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(dir)).sort();
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}

function buildDbUrlFromService(url, _serviceKey) {
  // Supabase exposes Postgres at db.<ref>.supabase.co:5432 with the project password.
  // The service_role JWT is NOT the DB password. So we cannot connect with it directly.
  // Instead, use the Supabase Management API's query endpoint — but that needs PAT.
  //
  // Most reliable path for this script: require SUPABASE_DB_URL.
  fail(
    "Direct DB connection requires SUPABASE_DB_URL.\n" +
      "Get it from: Supabase Studio → Project Settings → Database → Connection String → URI\n" +
      "Then add to .env.local:\n" +
      "  SUPABASE_DB_URL=postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres\n" +
      "(Or paste the SQL from migrations/0001_init.sql directly into the SQL Editor.)"
  );
}

async function runViaPg(connStr, sql) {
  let pg;
  try {
    pg = require("pg");
  } catch {
    fail(
      "The 'pg' package is not installed. Run:\n  npm install --no-save pg\nthen re-run npm run db:migrate"
    );
  }
  const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
