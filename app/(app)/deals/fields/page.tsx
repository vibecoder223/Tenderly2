import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import DealFieldsManager from "./DealFieldsManager";
import type { DealFieldDef } from "@/lib/deal-fields";

export default async function DealFieldsPage() {
  const { supabase, member } = await requireMembership();

  const { data } = await supabase
    .from("deal_field_definitions")
    .select("*")
    .eq("org_id", member.org_id)
    .order("position", { ascending: true });

  const isAdmin = ["admin", "owner"].includes((member as any).role);

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb><Link href="/deals" style={{ color: "inherit" }}>Deals</Link></Crumb>
            <Crumb last>Fields</Crumb>
          </>
        }
        actions={
          <Link href="/deals" className="btn">← Back to deals</Link>
        }
      />
      <div className="p-7 max-w-[760px] space-y-6">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Deal fields</h1>
          </div>
          <p className="page-sub">
            Custom fields shown on every new deal. Define them once — like a Microsoft List.
          </p>
        </div>

        <DealFieldsManager
          initial={(data ?? []) as DealFieldDef[]}
          canEdit={isAdmin}
        />
      </div>
    </>
  );
}
