import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getClaimsUser } from "@/utils/auth";
import { createClient } from "@/utils/supabase/server";

// The marketing site lives in its own project (Propello-LandingPage), deployed
// separately. This deployment is the product only, so the root just routes each
// visitor to the right place: signed-in users into the app, everyone else to login.
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
