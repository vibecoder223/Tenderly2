import { cache } from "react";
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

// The subset of auth user fields this app reads. All of them live inside the
// access-token JWT, so they can be pulled from locally verified claims without
// a round-trip to the auth server.
export type SessionUser = {
  id: string;
  email: string;
  user_metadata: Record<string, any>;
};

// Verify the session locally via getClaims(): the JWT signature is checked
// against the project's public signing keys (JWKS, cached in-process) instead
// of calling the auth server — getUser() costs a ~300ms network round-trip on
// EVERY request. Expired sessions still refresh over the network as before.
export async function getClaimsUser(
  supabase: ReturnType<typeof createClient>
): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    user_metadata: (claims.user_metadata as Record<string, any>) ?? {},
  };
}

// cache() dedupes within a single server render. The (app) layout AND the page
// both call these — without caching, the auth check (and the team_members
// query) runs twice per navigation. Cached, it runs once.
export const requireUser = cache(async () => {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) redirect("/auth/login");
  return { user, supabase };
});

export const requireMembership = cache(async () => {
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
});
