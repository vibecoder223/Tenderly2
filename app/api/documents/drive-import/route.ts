import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { logActivity } from "@/utils/activity";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Import an RFP document into a deal from Google Drive.
 * Client uses the Google Picker (lib/google-picker.ts) → { fileId, name, mimeType, accessToken }.
 * Server fetches the file via the short-lived OAuth token, stores it in the
 * `documents` bucket, and inserts a `documents` row in "uploaded" state.
 * The client then kicks off /api/documents/process (same as a manual upload).
 */

type DriveImportBody = {
  fileId?: string;
  name?: string;
  mimeType?: string;
  accessToken?: string;
  deal_id?: string;
};

/** Map Google native MIME types to an export MIME + extension the pipeline can read. */
function exportTargetFor(mime: string): { exportMime: string; ext: string } | null {
  switch (mime) {
    case "application/vnd.google-apps.document":
      return { exportMime: "application/pdf", ext: "pdf" };
    case "application/vnd.google-apps.spreadsheet":
      return { exportMime: "text/csv", ext: "csv" };
    case "application/vnd.google-apps.presentation":
      return { exportMime: "application/pdf", ext: "pdf" };
    default:
      return null; // binary file (pdf/docx/txt) → download directly
  }
}

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as DriveImportBody;
  const { fileId, name, mimeType, accessToken, deal_id } = body;
  if (!fileId || !accessToken || !mimeType || !deal_id) {
    return NextResponse.json({ error: "fileId, mimeType, accessToken, deal_id required" }, { status: 400 });
  }

  // Verify the deal belongs to the caller's org.
  const { data: deal } = await supabase
    .from("deals")
    .select("id, org_id")
    .eq("id", deal_id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  /* ── Fetch file from Drive ────────────────────────────────────────────── */
  let bytes: Buffer;
  let filename: string;
  let storedMime: string;

  try {
    const exportTarget = exportTargetFor(mimeType);
    let driveUrl: string;
    if (exportTarget) {
      driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportTarget.exportMime)}`;
      storedMime = exportTarget.exportMime;
      filename = `${(name || `gdrive-${fileId}`).replace(/\.[^.]+$/, "")}.${exportTarget.ext}`;
    } else {
      driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      storedMime = mimeType;
      filename = name || `gdrive-${fileId}`;
    }

    const res = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Drive API ${res.status}: ${errText.slice(0, 200) || res.statusText}`);
    }
    bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) throw new Error("Drive returned empty file");
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }

  /* ── Upload to storage ────────────────────────────────────────────────── */
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${deal_id}/${Date.now()}-gdrive-${safe}`;
  const storage = (tryCreateAdminClient() ?? supabase).storage.from("documents");
  const { error: uploadErr } = await storage.upload(objectPath, bytes, {
    contentType: storedMime,
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  /* ── Insert record ────────────────────────────────────────────────────── */
  const { data: doc, error: insertErr } = await supabase
    .from("documents")
    .insert({
      deal_id,
      filename,
      file_path: objectPath,
      file_size: bytes.length,
      mime_type: storedMime,
      processing_status: "uploaded",
    })
    .select()
    .single();
  if (insertErr) {
    await storage.remove([objectPath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await logActivity(supabase, {
    org_id: deal.org_id,
    user_id: user.id,
    action: "uploaded",
    entity_type: "document",
    entity_id: doc.id,
    metadata: { filename, size: bytes.length, source: "google_drive" },
  });

  return NextResponse.json({ document: doc });
}
