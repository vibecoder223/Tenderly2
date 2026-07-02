import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { callGroqText } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = (await req.json()) as {
    instruction?: string;
    name?: string;
    maxWords?: number;
  };
  const rawInstruction =
    (body.instruction && body.instruction.trim()) ||
    `Write the "${body.name || "section"}" section for this RFP response proposal.`;

  // Most recent deal in the org = sample context for preview.
  let deal: any = null;
  try {
    const r = await supabase
      .from("deals")
      .select(
        "name, client_name, value, sector, region, owner_id, organizations(name)"
      )
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    deal = r.data;
  } catch {
    deal = null;
  }

  let ownerName: string | null = null;
  if (deal?.owner_id) {
    const { data: ownerRow } = await supabase
      .from("team_members")
      .select("name, email")
      .eq("user_id", deal.owner_id)
      .maybeSingle();
    ownerName = ownerRow?.name || ownerRow?.email || null;
  }

  const ctx = {
    client_name: deal?.client_name ?? "the client",
    company_name: deal?.organizations?.name ?? "our company",
    rfp_title: deal?.name ?? "this RFP",
    sector: deal?.sector ?? "",
    region: deal?.region ?? "",
    owner_name: ownerName ?? "",
    value: deal?.value != null ? String(deal.value) : "",
  };

  function expandTokens(text: string): string {
    return text
      .replace(/\[Client Name\]/gi, ctx.client_name)
      .replace(/\[Company Name\]/gi, ctx.company_name)
      .replace(/\[RFP Title\]/gi, ctx.rfp_title)
      .replace(/\[Sector\]/gi, ctx.sector)
      .replace(/\[Region\]/gi, ctx.region)
      .replace(/\[Owner\]/gi, ctx.owner_name)
      .replace(/\[Value\]/gi, ctx.value);
  }

  const contextSummary = [
    ctx.client_name && `Client: ${ctx.client_name}`,
    ctx.rfp_title && `RFP: ${ctx.rfp_title}`,
    ctx.company_name && `Company: ${ctx.company_name}`,
    ctx.sector && `Sector: ${ctx.sector}`,
    ctx.region && `Region: ${ctx.region}`,
    ctx.owner_name && `Prepared by: ${ctx.owner_name}`,
    ctx.value && `Contract value: ${ctx.value}`,
  ].filter(Boolean).join("\n");

  const wl = body.maxWords && body.maxWords > 0 ? body.maxWords : null;
  const lengthRule = wl
    ? `Keep this section under ${wl} words. Be concise.`
    : "Write 2-3 concise paragraphs.";

  try {
    const { text } = await callGroqText({
      system: `You are writing a section of a professional RFP proposal response.
Write in formal business English. ${lengthRule} Be persuasive and outcome-focused.
Never invent facts not in the context. Do not include the section heading in your output.

Deal context:\n${contextSummary}`,
      user: expandTokens(rawInstruction),
      maxTokens: wl ? Math.min(500, Math.ceil(wl * 1.6) + 40) : 500,
    });
    return NextResponse.json({ text: text.trim(), sampleDeal: deal?.name ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Generation failed" }, { status: 502 });
  }
}
