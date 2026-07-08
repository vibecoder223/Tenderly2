import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: doc } = await admin.from("documents").select("id").order("created_at",{ascending:false}).limit(1).single();
const { data: qs } = await admin.from("questions").select("id, requirement_id, question_text").eq("document_id", doc.id);
const qmap = Object.fromEntries((qs??[]).map(q=>[q.id,q]));
const qIds=(qs??[]).map(q=>q.id);
let resps=[];
for(let i=0;i<qIds.length;i+=100){ const {data}=await admin.from("responses").select("*").in("question_id", qIds.slice(i,i+100)); if(data)resps.push(...data);}
console.log("response row columns:", Object.keys(resps[0]||{}).join(", "));
console.log("\n===== NO-SOURCE responses (gap_flag=no_source) — do they have draft text? =====");
const noSrc = resps.filter(r=>r.gap_flag==="no_source");
console.log("count:", noSrc.length, "| with draft_text:", noSrc.filter(r=>(r.draft_text??"").trim()).length);
noSrc.slice(0,4).forEach((r,i)=>{
  const q=qmap[r.question_id]||{};
  console.log(`\n--- [${i+1}] ${q.requirement_id}: ${(q.question_text||"").slice(0,90)}`);
  console.log(`    gap_flag=${r.gap_flag} conf=${r.confidence} citations=${JSON.stringify(r.citations)}`);
  console.log(`    DRAFT: ${(r.draft_text||"(empty)").replace(/\n/g," ").slice(0,300)}`);
});
console.log("\n===== SOURCED responses — citations present? =====");
const sourced = resps.filter(r=>r.gap_flag!=="no_source" && (r.draft_text??"").trim());
sourced.slice(0,3).forEach((r,i)=>{
  const q=qmap[r.question_id]||{};
  console.log(`\n--- [${i+1}] ${q.requirement_id}: ${(q.question_text||"").slice(0,80)}`);
  console.log(`    gap_flag=${r.gap_flag} conf=${r.confidence} citations=${JSON.stringify(r.citations)}`);
  console.log(`    DRAFT: ${(r.draft_text||"").replace(/\n/g," ").slice(0,260)}`);
});
