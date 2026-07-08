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
for(let i=0;i<qIds.length;i+=100){ const {data}=await admin.from("responses").select("question_id, draft_text, answer_text_with_markers, confidence, gap_flag").in("question_id", qIds.slice(i,i+100)); if(data)resps.push(...data);}

console.log("===== The 9 NO-SOURCE responses that STILL wrote an answer =====");
const bad = resps.filter(r=>r.gap_flag==="no_source" && (r.draft_text??"").trim());
bad.forEach((r,i)=>{
  const q=qmap[r.question_id]||{};
  console.log(`\n[${i+1}] ${q.requirement_id}: ${(q.question_text||"").slice(0,80)}`);
  console.log(`    conf=${r.confidence}`);
  console.log(`    ANSWER: ${(r.draft_text||"").replace(/\n/g," ").slice(0,300)}`);
});

console.log("\n\n===== Do SOURCED answers carry citation markers? (answer_text_with_markers) =====");
const sourced = resps.filter(r=>r.gap_flag!=="no_source" && (r.draft_text??"").trim());
let withMarkers=0, withoutMarkers=0;
sourced.forEach(r=>{ if(/\[c:\d/.test(r.answer_text_with_markers||"")) withMarkers++; else withoutMarkers++; });
console.log(`sourced answers: ${sourced.length} | WITH [c:N] markers: ${withMarkers} | WITHOUT: ${withoutMarkers}`);
console.log("\nsample answer_text_with_markers:");
sourced.slice(0,2).forEach((r,i)=>console.log(`  [${i+1}] ${(r.answer_text_with_markers||"(none)").replace(/\n/g," ").slice(0,320)}`));
