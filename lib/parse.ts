/**
 * Page-aware document parsing. Returns a sequence of typed blocks with page
 * numbers and detected section paths. PDF uses pdfjs-dist; DOCX uses mammoth
 * with style hints; TXT is treated as one page.
 *
 * The boundary is `parseDocument()` — swapping in a Python `unstructured`
 * sidecar later is a drop-in replacement for this single function.
 */

import mammoth from "mammoth";

export type Block = {
  type: "heading" | "paragraph" | "list_item" | "table";
  text: string;
  page: number;
  /** Heading depth (1..6) when type==='heading'. */
  level?: number;
};

export type ParsedDoc = {
  blocks: Block[];
  page_count: number;
  /** Plain concatenated text — kept for fallback paths. */
  raw_text: string;
};

export async function parseDocument(
  buf: Buffer,
  mime: string | null,
  filename: string
): Promise<ParsedDoc> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "application/pdf" || ext === "pdf") return parsePdf(buf);
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return parseDocx(buf);
  }
  if (mime === "text/plain" || ext === "txt") return parseTxt(buf);
  throw new Error(`Unsupported file type for parsing: ${mime || ext}`);
}

// ---------- PDF (pdfjs-dist, page-aware) ----------

async function parsePdf(buf: Buffer): Promise<ParsedDoc> {
  // pdfjs-dist 4.x ships ESM. Use the legacy build to stay Node-friendly.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Disable worker — we run on the server.
  // @ts-expect-error global
  pdfjs.GlobalWorkerOptions.workerSrc = undefined;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    useSystemFonts: true,
    // Avoid pdfjs trying to fetch standard fonts over HTTP in a serverless env.
    disableFontFace: true,
    standardFontDataUrl: undefined,
  });
  const pdf = await loadingTask.promise;

  const blocks: Block[] = [];
  const rawParts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // Group items into visual lines by their y-coordinate.
    const lines: { y: number; height: number; text: string }[] = [];
    for (const item of tc.items as any[]) {
      if (!("str" in item) || !item.str) continue;
      const transform = item.transform as number[];
      const y = transform[5];
      const h = item.height || 10;
      const existing = lines.find((l) => Math.abs(l.y - y) <= 1);
      if (existing) {
        existing.text += " " + item.str;
        existing.height = Math.max(existing.height, h);
      } else {
        lines.push({ y, height: h, text: item.str });
      }
    }
    // Sort lines top-to-bottom (pdfjs y grows upward).
    lines.sort((a, b) => b.y - a.y);

    const heightStats = lines.map((l) => l.height).sort((a, b) => a - b);
    const medianHeight = heightStats[Math.floor(heightStats.length / 2)] || 10;

    let buffer = "";
    const flushParagraph = () => {
      const t = buffer.replace(/\s+/g, " ").trim();
      if (t) blocks.push({ type: "paragraph", text: t, page: p });
      buffer = "";
    };

    for (const line of lines) {
      const text = line.text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      rawParts.push(text);

      const isHeading =
        line.height >= medianHeight * 1.15 &&
        text.length <= 140 &&
        !/[.;]$/.test(text);
      if (isHeading) {
        flushParagraph();
        // Heading level: bigger heights → smaller h-level
        const level = Math.max(
          1,
          Math.min(6, 7 - Math.round(line.height / medianHeight))
        );
        blocks.push({ type: "heading", text, page: p, level });
        continue;
      }

      if (/^\s*(?:[-•●◦*]|\d+[.)]|[a-z][.)])\s+/.test(text)) {
        flushParagraph();
        blocks.push({
          type: "list_item",
          text: text.replace(/^\s*(?:[-•●◦*]|\d+[.)]|[a-z][.)])\s+/, ""),
          page: p,
        });
        continue;
      }

      buffer = buffer ? `${buffer} ${text}` : text;
      // Break paragraph on full stop near line end.
      if (/[.!?]\s*$/.test(text) && buffer.length > 60) flushParagraph();
    }
    flushParagraph();
  }

  return {
    blocks,
    page_count: pdf.numPages,
    raw_text: rawParts.join("\n"),
  };
}

// ---------- DOCX (mammoth + style hints) ----------

async function parseDocx(buf: Buffer): Promise<ParsedDoc> {
  // Convert to HTML so we keep heading/list information; one synthetic page.
  const html = await mammoth.convertToHtml({ buffer: buf });
  const blocks: Block[] = [];
  const rawParts: string[] = [];

  const re = /<(h([1-6])|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html.value)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[3]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (!inner) continue;
    rawParts.push(inner);
    if (tag.startsWith("h")) {
      blocks.push({ type: "heading", text: inner, page: 1, level: Number(m[2]) });
    } else if (tag === "li") {
      blocks.push({ type: "list_item", text: inner, page: 1 });
    } else {
      blocks.push({ type: "paragraph", text: inner, page: 1 });
    }
  }
  return { blocks, page_count: 1, raw_text: rawParts.join("\n") };
}

// ---------- TXT ----------

function parseTxt(buf: Buffer): ParsedDoc {
  const text = buf.toString("utf8");
  const blocks: Block[] = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map<Block>((t) => ({ type: "paragraph", text: t, page: 1 }));
  return { blocks, page_count: 1, raw_text: text };
}
