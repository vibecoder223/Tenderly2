import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env={};const raw=await readFile(path.join(process.cwd(),".env.local"),"utf8");for(const l of raw.split("\n")){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)env[m[1]]=m[2];}
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const {data:doc}=await admin.from("documents").select("id").order("created_at",{ascending:false}).limit(1).single();
const {data:qs}=await admin.from("questions").select("id,requirement_id,question_text").eq("document_id",doc.id).in("requirement_id",["Q5.8","Q6.7","Q6.8","Q7.4"]);
for(const q of qs){
  const {data:resp}=await admin.from("responses").select("draft_text,gap_flag,confidence,answer_text_with_markers,updated_at").eq("question_id",q.id).order("updated_at",{ascending:false}).limit(1).single();
  console.log(`[${q.requirement_id}] gap=${resp.gap_flag} conf=${resp.confidence}`);
  console.log(`  ${q.question_text}`);
  console.log(`  raw: ${(resp.answer_text_with_markers||"(empty)").replace(/\n/g," ").slice(0,200)}\n`);
}
