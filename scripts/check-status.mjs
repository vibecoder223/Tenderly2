import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: doc } = await admin.from("documents").select("id, filename, processing_status, error_message").order("created_at", { ascending: false }).limit(1).single();
console.log("doc:", doc);
const { data: jobs } = await admin.from("jobs").select("stage, status, attempts, error").eq("document_id", doc.id);
console.log("jobs:", jobs);
const { data: runs } = await admin.from("agent_runs").select("agent_type, status, input_tokens, output_tokens, error_message").eq("document_id", doc.id);
console.log("runs:", runs);
