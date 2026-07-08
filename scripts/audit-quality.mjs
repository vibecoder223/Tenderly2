import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const KEY = env.MISTRAL_API_KEY;
async function embed(texts){const r=await fetch("https://api.mistral.ai/v1/embeddings",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${KEY}`},body:JSON.stringify({model:"mistral-embed",input:texts})});const j=await r.json();return j.data.sort((a,b)=>a.index-b.index).map(d=>d.embedding);}

const { data: doc } = await admin.from("documents").select("id, deal_id, filename").order("created_at",{ascending:false}).limit(1).single();
const { data: deal } = await admin.from("deals").select("org_id").eq("id", doc.deal_id).single();
const orgId = deal.org_id;
const { data: kb } = await admin.from("document_chunks").select("id, section_title").eq("org_id", orgId).not("knowledge_document_id","is",null);
const titleOf = Object.fromEntries((kb||[]).map(c=>[c.id, c.section_title]));

const { data: qs } = await admin.from("questions").select("id, requirement_id, question_text").eq("document_id", doc.id);
qs.sort((a,b)=>a.requirement_id.localeCompare(b.requirement_id,undefined,{numeric:true}));
const qIds = qs.map(q=>q.id);
let resps=[];
for(let i=0;i<qIds.length;i+=100){const {data}=await admin.from("responses").select("question_id, draft_text, gap_flag, confidence, updated_at").in("question_id",qIds.slice(i,i+100));if(data)resps.push(...data);}
// dedup: one row per question, prefer the most recently updated
const rByQ={};
for(const r of resps){const p=rByQ[r.question_id];if(!p||new Date(r.updated_at)>new Date(p.updated_at))rByQ[r.question_id]=r;}
console.log(`Doc: ${doc.filename} | KB chunks: ${kb.length} | responses(dedup): ${Object.keys(rByQ).length}`);
const dist={};for(const q of qs){const g=rByQ[q.id]?.gap_flag||'none';dist[g]=(dist[g]||0)+1;}
console.log(`gap_flag distribution: ${JSON.stringify(dist)}\n`);

const embs = await embed(qs.map(q=>q.question_text));
console.log("========== NO-SOURCE — does the KB actually cover it? (top KB cosine) ==========");
for(let i=0;i<qs.length;i++){
  const q=qs[i]; const r=rByQ[q.id]||{};
  if(r.gap_flag!=="no_source") continue;
  const {data:rows}=await admin.rpc("match_chunks",{p_org_id:orgId,p_embedding:embs[i],p_match_count:2});
  const t=(rows||[]).map(x=>`${titleOf[x.chunk_id]||'?'} ${x.similarity.toFixed(2)}`);
  const strong = rows?.[0]?.similarity>=0.75 ? "  <-- KB LIKELY COVERS THIS" : "";
  console.log(`[${q.requirement_id}] ${q.question_text.slice(0,72)}`);
  console.log(`   top: ${t[0]} | ${t[1]||'-'}${strong}`);
}
