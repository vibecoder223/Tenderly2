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
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">New deal</h1>
          </div>
          <p className="page-sub">Set up the workspace. Upload the RFP in the next step.</p>
        </div>
        <NewDealForm />
      </div>
    </>
  );
}
