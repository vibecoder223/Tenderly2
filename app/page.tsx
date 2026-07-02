import { getClaimsUser } from "@/utils/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export default async function RootPage() {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  redirect(member ? "/dashboard" : "/auth/onboarding");
}
