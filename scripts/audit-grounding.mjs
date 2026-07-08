import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env={};const raw=await readFile(path.join(process.cwd(),".env.local"),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2];}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:doc}=await admin.from("documents").select("id,deal_id").order("created_at",{ascending:false}).limit(1).single();
const {data:qs}=await admin.from("questions").select("id,requirement_id,question_text").eq("document_id",doc.id);
const qMap=Object.fromEntries(qs.map(q=>[q.id,q]));
const qIds=qs.map(q=>q.id);
let resps=[];for(let i=0;i<qIds.length;i+=100){const {data}=await admin.from("responses").select("question_id,draft_text,gap_flag,confidence,updated_at").in("question_id",qIds.slice(i,i+100));if(data)resps.push(...data);}
const rByQ={};for(const r of resps){const p=rByQ[r.question_id];if(!p||new Date(r.updated_at)>new Date(p.updated_at))rByQ[r.question_id]=r;}
const drafted=Object.values(rByQ).filter(r=>(r.draft_text||"").trim()).sort((a,b)=>(qMap[a.question_id].requirement_id).localeCompare(qMap[b.question_id].requirement_id,undefined,{numeric:true}));
console.log(`DRAFTED ANSWERS: ${drafted.length}\n`);
for(const r of drafted){const q=qMap[r.question_id];
  console.log(`[${q.requirement_id}] conf=${r.confidence} ${q.question_text.slice(0,70)}`);
  console.log(`  → ${(r.draft_text||"").replace(/\n/g," ").trim()}\n`);
}
