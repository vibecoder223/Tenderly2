import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { ingestKnowledgeDocument } from "@/lib/ingest";
import { safeFetch } from "@/lib/safe-fetch";

export const runtime = "nodejs";
export const maxDuration = 120;

/* ── Google Drive URL → export URL ──────────────────────────────────────── */

type DriveExport = { exportUrl: string; filename: string; mime: string };

function parseDriveUrl(raw: string): DriveExport | null {
  try {
    const u = new URL(raw);

    // Google Docs  →  export as plain text
    const docMatch = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch) {
      return {
        exportUrl: `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`,
        filename: `gdoc-${docMatch[1]}.txt`,
        mime: "text/plain",
      };
    }

    // Google Sheets  →  export as CSV
    const sheetMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetMatch) {
      return {
        exportUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`,
        filename: `gsheet-${sheetMatch[1]}.csv`,
        mime: "text/csv",
      };
    }

    // Google Slides  →  export as plain text
    const slidesMatch = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch) {
      return {
        exportUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/export/txt`,
        filename: `gslides-${slidesMatch[1]}.txt`,
        mime: "text/plain",
      };
    }

    // Drive file link  /file/d/ID/view
    const fileMatch = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch) {
      return {
        exportUrl: `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`,
        filename: `gdrive-${fileMatch[1]}`,
        mime: "application/octet-stream",
      };
    }

    // drive.google.com/open?id=ID
    const openId = u.searchParams.get("id");
    if (u.hostname === "drive.google.com" && openId) {
      return {
        exportUrl: `https://drive.google.com/uc?export=download&id=${openId}`,
        filename: `gdrive-${openId}`,
        mime: "application/octet-stream",
      };
    }
  } catch { /* invalid URL */ }
  return null;
}

/* ── HTML → plain text ───────────────────────────────────────────────────── */

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── Route ───────────────────────────────────────────────────────────────── */

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

  const body = await req.json().catch(() => ({}));
  const { url, doc_type = "other" } = body as { url?: string; doc_type?: string };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const docTypeClean = ["past_proposal", "security_doc", "policy", "other"].includes(doc_type)
    ? doc_type
    : "other";

  /* ── Fetch content ────────────────────────────────────────────────────── */
  let bytes: Buffer;
  let filename: string;
  let mimeType: string;

  const drive = parseDriveUrl(url);

  try {
    const fetchUrl = drive?.exportUrl ?? url;
    // safeFetch blocks private/internal/metadata addresses (SSRF), re-validates
    // every redirect hop, and caps the response size.
    const { res, body } = await safeFetch(fetchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 Propello/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Fetch returned ${res.status}: ${res.statusText}`);

    if (drive) {
      filename = drive.filename;
      mimeType = drive.mime;
      const raw = body;
      // Drive sometimes redirects to a "Download anyway" HTML warning page for large files
      if (raw.slice(0, 20).toString("utf8").toLowerCase().startsWith("<!doctype") ||
          raw.slice(0, 5).toString("utf8").toLowerCase() === "<html") {
        throw new Error(
          "Google Drive returned an HTML page instead of the file. " +
          "Make sure the document is shared as 'Anyone with the link can view'."
        );
      }
      bytes = raw;
    } else {
      // Web page — strip HTML
      const html = body.toString("utf-8");
      const text = htmlToText(html);
      if (text.length < 100) throw new Error("Page returned too little text to be useful.");
      const urlObj = new URL(url);
      const slug = (urlObj.hostname + urlObj.pathname)
        .replace(/[^a-zA-Z0-9.-]/g, "-")
        .replace(/-{2,}/g, "-")
        .slice(0, 80);
      filename = `web-${slug}.txt`;
      mimeType = "text/plain";
      bytes = Buffer.from(text, "utf-8");
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 422 });
  }

  /* ── Upload to storage ───────────────────────────────────────────────── */
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${member.org_id}/${Date.now()}-${safe}`;
  const storage = (tryCreateAdminClient() ?? supabase).storage.from("knowledge");
  const { error: uploadErr } = await storage.upload(objectPath, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  /* ── Insert record ───────────────────────────────────────────────────── */
  const writer = tryCreateAdminClient() ?? supabase;
  const { data: row, error: insertErr } = await writer
    .from("knowledge_documents")
    .insert({
      org_id: member.org_id,
      filename,
      file_path: objectPath,
      file_size: bytes.length,
      mime_type: mimeType,
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

  /* ── Ingest ──────────────────────────────────────────────────────────── */
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
