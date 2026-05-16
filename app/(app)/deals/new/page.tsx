import Topbar, { Crumb } from "@/components/Topbar";
import NewDealForm from "./form";

export default function NewDealPage() {
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
        <h1 className="text-[18px] font-semibold mb-1" style={{ color: "var(--fg)" }}>Create a new deal</h1>
        <p className="text-sm mb-6" style={{ color: "var(--fg-4)" }}>
          You can upload an RFP file in the next step.
        </p>
        <NewDealForm />
      </div>
    </>
  );
}
