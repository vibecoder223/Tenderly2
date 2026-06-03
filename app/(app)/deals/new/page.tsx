import Topbar, { Crumb } from "@/components/Topbar";
import NewDealForm from "./form";
import { requireMembership } from "@/utils/auth";
import type { DealFieldDef } from "@/lib/deal-fields";

export default async function NewDealPage() {
  const { supabase, member } = await requireMembership();

  const [{ data: fields }, { data: people }] = await Promise.all([
    supabase
      .from("deal_field_definitions")
      .select("*")
      .eq("org_id", member.org_id)
      .eq("archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("team_members")
      .select("user_id, name, email")
      .eq("org_id", member.org_id),
  ]);

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Deals</Crumb>
            <Crumb last>New</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[640px]">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">New deal</h1>
          </div>
          <p className="page-sub">Set up the workspace. Upload the RFP in the next step.</p>
        </div>
        <NewDealForm
          fields={(fields ?? []) as DealFieldDef[]}
          people={(people ?? []) as any[]}
          canManage={["admin", "owner"].includes((member as any).role)}
        />
      </div>
    </>
  );
}
