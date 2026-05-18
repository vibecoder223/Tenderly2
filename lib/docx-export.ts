/**
 * Branded .docx export with inline citations or footnotes.
 * Uses `docx` (npm) — produces a real Word file that opens in MS Word + Google Docs.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Footer,
  PageNumber,
} from "docx";

export type ExportQuestion = {
  requirement_id: string | null;
  question_text: string;
  citations: { document_filename: string; page: number | null }[];
  answer: string;
  gap_flag: "ok" | "partial" | "no_source" | null;
};

export type ExportOptions = {
  deal_name: string;
  client_name: string | null;
  org_name: string | null;
  citation_style: "inline" | "footnote";
};

export async function renderDocx(
  questions: ExportQuestion[],
  opts: ExportOptions
): Promise<Buffer> {
  const titleParas = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "RFP Response", bold: true, size: 48 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: opts.deal_name, size: 28, color: "5B6478" })],
      spacing: { after: 100 },
    }),
  ];
  if (opts.client_name) {
    titleParas.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Prepared for ${opts.client_name}`, size: 22, color: "8A93A6" }),
        ],
      })
    );
  }
  if (opts.org_name) {
    titleParas.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Submitted by ${opts.org_name}`, size: 22, color: "8A93A6" }),
        ],
      })
    );
  }
  titleParas.push(
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          size: 20,
          color: "8A93A6",
        }),
      ],
      spacing: { after: 600 },
    })
  );

  const bodyParas: Paragraph[] = [];
  // Footnote refs are numbered across the whole doc.
  let footnoteCounter = 0;

  for (const q of questions) {
    // Requirement ID
    if (q.requirement_id) {
      bodyParas.push(
        new Paragraph({
          children: [
            new TextRun({ text: q.requirement_id, bold: true, color: "3B47D6", size: 20 }),
          ],
          spacing: { before: 240, after: 60 },
        })
      );
    }
    // Question
    bodyParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: q.question_text, bold: true, size: 24 })],
        spacing: { after: 120 },
      })
    );

    // Answer
    if (q.gap_flag === "no_source") {
      bodyParas.push(
        new Paragraph({
          children: [
            new TextRun({
              text:
                "No source found in the knowledge base. This requirement requires human review before submission.",
              italics: true,
              color: "C0392B",
              size: 22,
            }),
          ],
          spacing: { after: 240 },
        })
      );
      continue;
    }

    const answerRuns: TextRun[] = [
      new TextRun({ text: q.answer || "(no response)", size: 22 }),
    ];

    if (opts.citation_style === "inline") {
      const inline = q.citations
        .map((c) => `[Source: ${c.document_filename}${c.page != null ? `, p.${c.page}` : ""}]`)
        .join(" ");
      if (inline) answerRuns.push(new TextRun({ text: ` ${inline}`, size: 20, color: "5B6478" }));
    } else if (opts.citation_style === "footnote" && q.citations.length > 0) {
      // Mark a footnote reference. We render as a superscript number + emit
      // the footnote text in a single "References" list at the end. (Real
      // .docx footnotes via `docx` package require its `footnotes` API which
      // is more involved; this is a clean, readable equivalent.)
      const refs: string[] = [];
      for (const c of q.citations) {
        footnoteCounter += 1;
        refs.push(`${footnoteCounter}`);
      }
      answerRuns.push(
        new TextRun({ text: ` [${refs.join(", ")}]`, superScript: true, size: 18, color: "3B47D6" })
      );
    }

    bodyParas.push(
      new Paragraph({
        children: answerRuns,
        spacing: { after: 240 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
  }

  if (opts.citation_style === "footnote") {
    bodyParas.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "References", bold: true, size: 28 })],
        spacing: { before: 480, after: 120 },
      })
    );
    let n = 0;
    for (const q of questions) {
      for (const c of q.citations) {
        n += 1;
        bodyParas.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${n}. `, bold: true, size: 20 }),
              new TextRun({
                text: `${c.document_filename}${c.page != null ? ` — page ${c.page}` : ""}`,
                size: 20,
              }),
            ],
          })
        );
      }
    }
  }

  const doc = new Document({
    creator: opts.org_name ?? "Tenderly",
    title: `RFP Response — ${opts.deal_name}`,
    description: "Generated by Tenderly",
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: opts.deal_name + " — Page ", size: 18, color: "8A93A6" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "8A93A6" }),
                  new TextRun({ text: " of ", size: 18, color: "8A93A6" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: "8A93A6" }),
                ],
              }),
            ],
          }),
        },
        children: [...titleParas, ...bodyParas],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
