import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: doc } = await admin.from("documents").select("id, deal_id").order("created_at",{ascending:false}).limit(1).single();
const { data: deal } = await admin.from("deals").select("org_id").eq("id", doc.deal_id).single();
const { data: qs } = await admin.from("questions").select("id").eq("document_id", doc.id);
const qIds = (qs??[]).map(q=>q.id);
// wipe existing responses so we regenerate cleanly
for(let i=0;i<qIds.length;i+=100){ await admin.from("responses").delete().in("question_id", qIds.slice(i,i+100)); }
// remove old generate job, enqueue fresh one
await admin.from("jobs").delete().eq("document_id", doc.id).eq("stage","generate");
await admin.from("documents").update({ processing_status: "structured" }).eq("id", doc.id);
const { error } = await admin.from("jobs").insert({ document_id: doc.id, org_id: deal.org_id, stage: "generate", status: "pending" });
console.log(error ? "ERR: "+error.message : `re-queued generate for doc ${doc.id} (${qIds.length} questions, responses wiped)`);
