import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgName, name } = await req.json();
  if (!orgName || typeof orgName !== "string") {
    return NextResponse.json({ error: "orgName required" }, { status: 400 });
  }

  // Onboarding has a fundamental chicken-and-egg with RLS: until the user has a
  // team_members row, they have no org membership the policies can grant against.
  // The right tool here is the service-role client. If it's not configured we fall
  // back to the user-context client and add a random slug suffix to dodge collisions.
  const admin = tryCreateAdminClient();
  const writer = admin ?? supabase;

  const baseSlug = slugify(orgName) || "workspace";
  let slug = baseSlug;

  if (admin) {
    // Uniqueness lookup is only meaningful with admin (RLS would otherwise hide rows).
    let suffix = 0;
    while (true) {
      const { data: existing } = await admin
        .from("organizations")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }
  } else {
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: org, error: orgErr } = await writer
    .from("organizations")
    .insert({ name: orgName, slug })
    .select()
    .single();
  if (orgErr) return NextResponse.json({ error: orgErr.message }, { status: 500 });

  const { error: memberErr } = await writer.from("team_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner",
    email: user.email ?? "",
    name: name ?? user.user_metadata?.name ?? "",
  });
  if (memberErr) {
    if (admin) await admin.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  await writer.from("org_settings").insert({ org_id: org.id });

  // ─── Seed sample data so the workspace isn't a blank slate ─────────────
  // Everything tagged is_sample=true so the onboarding checklist won't count
  // these toward completion, and the UI can render a "Sample" badge.
  await seedSampleData(writer, org.id, user.id);

  return NextResponse.json({ ok: true, org });
}

async function seedSampleData(writer: any, orgId: string, userId: string) {
  // Sample knowledge document. No chunks are seeded; this row exists so the
  // user can see what a populated knowledge base looks like before they upload
  // real material. Their first real upload powers actual retrieval.
  const { data: kdoc } = await writer
    .from("knowledge_documents")
    .insert({
      org_id: orgId,
      filename: "Sample — Acme Past Proposal.pdf",
      doc_type: "past_proposal",
      file_path: `sample/${orgId}/sample-past-proposal.pdf`,
      ingestion_status: "ready",
      uploaded_by: userId,
      is_sample: true,
    })
    .select("id")
    .single();

  // Sample deal in the active pipeline
  const dueDate = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { data: deal } = await writer
    .from("deals")
    .insert({
      org_id: orgId,
      name: "Sample — Acme Corp Q1 RFP",
      client_name: "Acme Corp",
      status: "in_progress",
      owner_id: userId,
      value: 250_000,
      due_date: dueDate,
      is_sample: true,
    })
    .select("id")
    .single();
  if (!deal) return;

  // Sample RFP document inside the deal
  const { data: doc } = await writer
    .from("documents")
    .insert({
      deal_id: deal.id,
      filename: "Sample-RFP.pdf",
      file_path: `sample/${orgId}/sample-rfp.pdf`,
      processing_status: "completed",
      is_sample: true,
    })
    .select("id")
    .single();
  if (!doc) return;

  // A few questions across the pipeline stages so the user can see what every
  // status looks like in the UI without having to wait for AI processing.
  const samples: Array<{ text: string; status: string; priority: string }> = [
    {
      text: "Describe your information security program and any relevant certifications (ISO 27001, SOC 2, etc.).",
      status: "approved",
      priority: "high",
    },
    {
      text: "What is your standard SLA for production incidents at severity 1?",
      status: "review",
      priority: "high",
    },
    {
      text: "Please summarize your approach to data encryption at rest and in transit.",
      status: "drafting",
      priority: "medium",
    },
    {
      text: "Describe your disaster recovery plan and recovery time objectives.",
      status: "todo",
      priority: "high",
    },
    {
      text: "List the integrations your platform supports out of the box.",
      status: "todo",
      priority: "low",
    },
  ];

  await writer.from("questions").insert(
    samples.map((s) => ({
      document_id: doc.id,
      question_text: s.text,
      status: s.status,
      priority: s.priority,
      is_sample: true,
    }))
  );
}
