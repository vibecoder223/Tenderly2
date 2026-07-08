import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: doc } = await admin.from("documents").select("id, deal_id, filename, processing_status").order("created_at",{ascending:false}).limit(1).single();
const { data: runs } = await admin.from("agent_runs").select("agent_type, input_tokens, output_tokens").eq("document_id", doc.id);
const { data: qs } = await admin.from("questions").select("id, category, priority, status").eq("document_id", doc.id);
const qIds = (qs??[]).map(q=>q.id);
// responses in batches to avoid URL limits
let resps=[];
for(let i=0;i<qIds.length;i+=100){ const {data}=await admin.from("responses").select("gap_flag, confidence, draft_text, question_id").in("question_id", qIds.slice(i,i+100)); if(data)resps.push(...data);}
const withText = resps.filter(r=>(r.draft_text??"").trim().length>0);
const noSrc = resps.filter(r=>r.gap_flag==="no_source");
const ext=(runs??[]).find(r=>r.agent_type==="extraction")||{};
const gen=(runs??[]).find(r=>r.agent_type==="generate")||{};
const extCost=(ext.input_tokens||0)/1e6*0.5+(ext.output_tokens||0)/1e6*1.5;
const genCost=(gen.input_tokens||0)/1e6*0.15+(gen.output_tokens||0)/1e6*0.6;
const cat={}; (qs??[]).forEach(q=>{cat[q.category]=(cat[q.category]||0)+1;});
const conf={}; withText.forEach(r=>{conf[r.confidence]=(conf[r.confidence]||0)+1;});
console.log("STATUS:", doc.processing_status, "| file:", doc.filename);
console.log("QUESTIONS:", qIds.length);
console.log("CATEGORIES:", JSON.stringify(cat));
console.log("RESPONSES:", resps.length, "| drafted:", withText.length, "| no-source:", noSrc.length);
console.log("CONFIDENCE:", JSON.stringify(conf));
console.log("EXTRACT:", ext.input_tokens,"in /",ext.output_tokens,"out = $"+extCost.toFixed(4));
console.log("GENERATE:", gen.input_tokens,"in /",gen.output_tokens,"out = $"+genCost.toFixed(4));
console.log("TOTAL TOKENS:", (ext.input_tokens||0)+(ext.output_tokens||0)+(gen.input_tokens||0)+(gen.output_tokens||0));
console.log("TOTAL COST: $"+(extCost+genCost).toFixed(4));
console.log("\nSAMPLES:");
withText.slice(0,3).forEach((r,i)=>console.log(`[${i+1}] conf=${r.confidence}: ${(r.draft_text||"").replace(/\n/g," ").slice(0,180)}...`));
