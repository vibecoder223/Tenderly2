import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import SettingsForm from "./SettingsForm";

export default async function SettingsPage() {
  const { supabase, member } = await requireMembership();
  const { data: settings } = await supabase
    .from("org_settings")
    .select("*")
    .eq("org_id", member.org_id)
    .maybeSingle();

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Settings</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[680px]">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Settings</h1>
          </div>
          <p className="page-sub">Workspace defaults — AI tone, model, monthly token budget.</p>
        </div>
        <SettingsForm
          orgName={member.organizations?.name ?? ""}
          settings={
            settings ?? {
              default_ai_tone: "technical",
              ai_model: "claude-sonnet-4-6",
              max_monthly_tokens: 500000,
            }
          }
        />
      </div>
    </>
  );
}
