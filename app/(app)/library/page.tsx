import { redirect } from "next/navigation";

// Reusable answers were merged into the Knowledge base as the "Answers" tab.
// Keep this route as a permanent redirect so old links / bookmarks still work.
export default function LibraryPage() {
  redirect("/knowledge?tab=answers");
}
