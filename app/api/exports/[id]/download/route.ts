import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row } = await supabase
    .from("exports")
    .select("file_path, deal_id, format")
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const storage = (tryCreateAdminClient() ?? supabase).storage.from("documents");
  const { data, error } = await storage.download(row.file_path);
  if (error || !data)
    return NextResponse.json({ error: error?.message || "Download failed" }, { status: 500 });

  const buf = Buffer.from(await data.arrayBuffer());
  const filename = row.file_path.split("/").pop() || `export.${row.format ?? "pdf"}`;
  const contentType =
    row.format === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";
  return new NextResponse(buf, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
