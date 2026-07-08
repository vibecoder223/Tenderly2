import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: doc } = await admin.from("documents").select("id").order("created_at", { ascending: false }).limit(1).single();
const { count } = await admin.from("document_chunks").select("id", {count:"exact",head:true}).eq("document_id", doc.id);
console.log("chunks:", count, "-> batches of 12:", Math.ceil(count/12));
