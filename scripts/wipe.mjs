#!/usr/bin/env node
/**
 * Destructive: wipes ALL application data from Supabase (orgs cascade,
 * storage objects, auth users). Schema is preserved.
 *
 * Usage: node scripts/wipe.mjs --yes
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--yes")) {
  console.error("Refusing without --yes. This deletes ALL application data.");
  process.exit(1);
}

const env = await loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) fail("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

console.log("→ Deleting all organizations (cascades to deals, docs, questions, …)");
const { error: e1 } = await admin.from("organizations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
if (e1) fail(e1.message);

// Belt-and-braces — kill any chunks not tied to an org (knowledge docs already cascaded)
await admin.from("document_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");

console.log("→ Clearing Storage buckets");
for (const bucket of ["documents", "knowledge"]) {
  let page = 0;
  while (true) {
    const { data: list, error } = await admin.storage
      .from(bucket)
      .list("", { limit: 1000, offset: page * 1000 });
    if (error) {
      console.warn(`  bucket ${bucket}: ${error.message}`);
      break;
    }
    if (!list || list.length === 0) break;
    const paths = await collectAllPaths(bucket, list, "");
    if (paths.length > 0) {
      const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
      if (rmErr) console.warn(`  remove ${bucket}: ${rmErr.message}`);
      else console.log(`  removed ${paths.length} from ${bucket}`);
    }
    if (list.length < 1000) break;
    page += 1;
  }
}

console.log("→ Deleting all auth users");
let userPage = 1;
let deleted = 0;
while (true) {
  const { data, error } = await admin.auth.admin.listUsers({ page: userPage, perPage: 200 });
  if (error) fail(error.message);
  const list = data.users ?? [];
  if (list.length === 0) break;
  for (const u of list) {
    await admin.auth.admin.deleteUser(u.id);
    deleted += 1;
  }
  if (list.length < 200) break;
  userPage += 1;
}
console.log(`  removed ${deleted} users`);

console.log("✓ Wipe complete.");

async function collectAllPaths(bucket, list, prefix) {
  const out = [];
  for (const item of list) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) {
      out.push(full);
    } else {
      // Folder — recurse
      const { data: sub } = await admin.storage.from(bucket).list(full, { limit: 1000 });
      if (sub && sub.length > 0) {
        const subPaths = await collectAllPaths(bucket, sub, full);
        out.push(...subPaths);
      }
    }
  }
  return out;
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

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}
