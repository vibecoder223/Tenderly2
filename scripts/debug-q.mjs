import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: doc } = await admin.from("documents").select("id, deal_id, filename, processing_status").order("created_at",{ascending:false}).limit(1).single();
console.log("DOC:", doc);
// try by document_id
const { count: byDoc } = await admin.from("questions").select("id",{count:"exact",head:true}).eq("document_id", doc.id);
console.log("questions by document_id:", byDoc);
// try by deal_id
const { count: byDeal } = await admin.from("questions").select("id",{count:"exact",head:true}).eq("deal_id", doc.deal_id);
console.log("questions by deal_id:", byDeal);
// total questions in org
const { data: anyQ } = await admin.from("questions").select("*").limit(2);
console.log("sample question row keys:", anyQ && anyQ[0] ? Object.keys(anyQ[0]) : "NONE", "| rows:", anyQ?.length);
if (anyQ && anyQ[0]) console.log("sample q:", JSON.stringify(anyQ[0]).slice(0,300));
