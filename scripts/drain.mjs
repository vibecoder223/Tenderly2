#!/usr/bin/env node
// Dev driver for the async pipeline. Polls /api/jobs/drain on an interval so
// you don't need pg_cron locally. In production, use pg_cron + pg_net (see
// migrations/optional/pgcron_drain.sql) or a vercel.json cron instead.
//
// Usage: npm run drain
// Env:   DRAIN_URL (default http://localhost:3000/api/jobs/drain)
//        CRON_SECRET (must match the server's), read from .env.local
//        DRAIN_INTERVAL_MS (default 2000)

import { readFile } from "node:fs/promises";
import path from "node:path";

const env = await loadEnv();
const URL = env.DRAIN_URL || "http://localhost:3000/api/jobs/drain";
const SECRET = env.CRON_SECRET;
const INTERVAL = Number(env.DRAIN_INTERVAL_MS || 2000);

if (!SECRET) {
  console.error("✗ CRON_SECRET not set in .env.local — the drain endpoint will reject calls.");
  process.exit(1);
}

console.log(`→ draining ${URL} every ${INTERVAL}ms (ctrl-c to stop)`);

let stop = false;
process.on("SIGINT", () => { stop = true; });

while (!stop) {
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-cron-secret": SECRET },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.claimed > 0) {
      for (const r of body.results ?? []) {
        console.log(`  ${r.ok ? "✓" : "✗"} ${r.stage}${r.error ? ` — ${r.error}` : ""}`);
      }
    } else if (!res.ok) {
      console.warn(`  drain ${res.status}: ${body.error ?? "error"}`);
    }
  } catch (e) {
    console.warn(`  drain unreachable: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, INTERVAL));
}

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
