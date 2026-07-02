import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { ingestKnowledgeDocument } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Google Drive native-picker import.
 * Client uses Google Picker → returns { fileId, name, mimeType, accessToken }.
 * Server fetches the file via Drive API using the short-lived OAuth token,
 * uploads it to Supabase storage, and runs the standard ingestion pipeline.
 */

type DriveImportBody = {
  fileId?: string;
  name?: string;
  mimeType?: string;
  accessToken?: string;
  doc_type?: string;
};

/** Map Google native MIME types to an export MIME + extension. */
function exportTargetFor(mime: string): { exportMime: string; ext: string } | null {
  switch (mime) {
    case "application/vnd.google-apps.document":
      return { exportMime: "text/plain", ext: "txt" };
    case "application/vnd.google-apps.spreadsheet":
      return { exportMime: "text/csv", ext: "csv" };
    case "application/vnd.google-apps.presentation":
      return { exportMime: "text/plain", ext: "txt" };
    default:
      return null; // binary file → download directly
  }
}

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as DriveImportBody;
  const { fileId, name, mimeType, accessToken, doc_type = "other" } = body;
  if (!fileId || !accessToken || !mimeType) {
    return NextResponse.json({ error: "fileId, mimeType, accessToken required" }, { status: 400 });
  }

  const docTypeClean = ["past_proposal", "security_doc", "policy", "other"].includes(doc_type)
    ? doc_type
    : "other";

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
  const objectPath = `${member.org_id}/${Date.now()}-gdrive-${safe}`;
  const storage = (tryCreateAdminClient() ?? supabase).storage.from("knowledge");
  const { error: uploadErr } = await storage.upload(objectPath, bytes, {
    contentType: storedMime,
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  /* ── Insert record ────────────────────────────────────────────────────── */
  const writer = tryCreateAdminClient() ?? supabase;
  const { data: row, error: insertErr } = await writer
    .from("knowledge_documents")
    .insert({
      org_id: member.org_id,
      filename,
      file_path: objectPath,
      file_size: bytes.length,
      mime_type: storedMime,
      doc_type: docTypeClean,
      ingestion_status: "pending",
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertErr) {
    await storage.remove([objectPath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  /* ── Ingest ───────────────────────────────────────────────────────────── */
  try {
    await ingestKnowledgeDocument(writer, {
      id: row.id,
      org_id: row.org_id,
      filename: row.filename,
      file_path: row.file_path,
      mime_type: row.mime_type,
    });
  } catch (e: any) {
    await writer
      .from("knowledge_documents")
      .update({ ingestion_status: "failed", error_message: e.message })
      .eq("id", row.id);
  }

  return NextResponse.json({ knowledge_document: row });
}
