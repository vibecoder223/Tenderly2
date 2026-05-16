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

  return NextResponse.json({ ok: true, org });
}
