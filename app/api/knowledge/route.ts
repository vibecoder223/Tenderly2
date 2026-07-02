import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("knowledge_documents")
    .select("id, filename, doc_type, ingestion_status, page_count, file_size, created_at, error_message")
    .order("created_at", { ascending: false });

  return NextResponse.json({ items: data ?? [] });
}
