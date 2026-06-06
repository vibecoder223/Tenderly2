"use client";

import { useRouter, useSearchParams } from "next/navigation";
import KnowledgeView from "./KnowledgeView";
import KnowledgeTestPanel from "@/components/KnowledgeTestPanel";
import AnswersView, { type Answer } from "./AnswersView";

export default function KnowledgeTabs({
  documents,
  answers,
}: {
  documents: any[];
  answers: Answer[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "answers" ? "answers" : "documents";

  function go(next: "documents" | "answers") {
    router.replace(next === "documents" ? "/knowledge" : "/knowledge?tab=answers");
  }

  return (
    <div className="space-y-6">
      <div className="seg">
        <button className={`seg-btn${tab === "documents" ? " active" : ""}`} onClick={() => go("documents")}>
          Documents <span className="seg-count">{documents.length}</span>
        </button>
        <button className={`seg-btn${tab === "answers" ? " active" : ""}`} onClick={() => go("answers")}>
          Answers <span className="seg-count">{answers.length}</span>
        </button>
      </div>

      {tab === "documents" ? (
        <div className="space-y-6">
          <KnowledgeView initial={documents} />
          <KnowledgeTestPanel />
        </div>
      ) : (
        <AnswersView answers={answers} />
      )}
    </div>
  );
}
