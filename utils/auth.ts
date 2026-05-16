import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export type MemberWithOrg = {
  id: string;
  org_id: string;
  role: string;
  name: string | null;
  email: string;
  organizations: { id: string; name: string; slug: string } | null;
};

export async function requireUser() {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return { user, supabase };
}

export async function requireMembership() {
  const { user, supabase } = await requireUser();
  const { data: memberRaw } = await supabase
    .from("team_members")
    .select("id, org_id, role, name, email, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!memberRaw) redirect("/auth/onboarding");

  // Normalize: PostgREST returns the joined relation as an object when
  // it's a single FK; cast for safety.
  const member = memberRaw as unknown as MemberWithOrg;
  return { user, supabase, member };
}
