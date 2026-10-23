import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { marked, type Token, type Tokens } from "marked";
import type { Outline } from "@/lib/schemas";

type ChapterExport = { number: number; title: string; markdown: string };

export async function buildDocx(outline: Outline, chapters: ChapterExport[]): Promise<Buffer> {
  const children: Paragraph[] = [];

  if (chapters.length > 1) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 240 },
        children: [new TextRun({ text: outline.title, font: "Georgia", size: 56 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
        children: [new TextRun({ text: "A Novel", font: "Georgia", size: 22, color: "6F6759" })],
      }),
    );
    if (outline.premise.trim()) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: outline.premise,
              font: "Georgia",
              size: 24,
              italics: true,
              color: "3A342B",
            }),
          ],
        }),
      );
    }
  }

  chapters.forEach((chapter, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: index > 0,
        spacing: { before: index === 0 ? 240 : 0, after: 360 },
        children: [
          new TextRun({
            text: `Chapter ${chapter.number}${chapter.title ? ` — ${chapter.title}` : ""}`,
            font: "Georgia",
            size: 34,
          }),
        ],
      }),
    );
    children.push(...markdownToParagraphs(chapter.markdown));
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Georgia", size: 24 },
          paragraph: { spacing: { line: 360, after: 180 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Georgia", size: 34, bold: false, color: "1A1712" },
          paragraph: { spacing: { before: 360, after: 240 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Georgia", size: 28, bold: true, color: "1A1712" },
          paragraph: { spacing: { before: 300, after: 180 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Georgia", size: 25, bold: true, color: "1A1712" },
          paragraph: { spacing: { before: 240, after: 140 } },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

function markdownToParagraphs(markdown: string): Paragraph[] {
  const tokens = marked.lexer(markdown);
  const output: Paragraph[] = [];
  for (const token of tokens) {
    output.push(...tokenToParagraphs(token));
  }
  return output;
}

function tokenToParagraphs(token: Token): Paragraph[] {
  switch (token.type) {
    case "space":
      return [];
    case "heading": {
      const heading = token as Tokens.Heading;
      const level =
        heading.depth === 1
          ? HeadingLevel.HEADING_2
          : heading.depth === 2
            ? HeadingLevel.HEADING_3
            : HeadingLevel.HEADING_4;
      return [new Paragraph({ heading: level, children: inlineRuns(heading.tokens) })];
    }
    case "paragraph": {
      const paragraph = token as Tokens.Paragraph;
      return [new Paragraph({ children: inlineRuns(paragraph.tokens) })];
    }
    case "blockquote": {
      const quote = token as Tokens.Blockquote;
      return quote.tokens.flatMap((child) => {
        if (child.type === "paragraph") {
          return [
            new Paragraph({
              indent: { left: 720 },
              children: inlineRuns((child as Tokens.Paragraph).tokens, { italics: true }),
            }),
          ];
        }
        return tokenToParagraphs(child);
      });
    }
    case "list": {
      const list = token as Tokens.List;
      const output: Paragraph[] = [];
      for (const item of list.items) {
        const itemTokens = item.tokens.filter((child) => child.type !== "space");
        const first = itemTokens[0];
        if (first?.type === "paragraph" || first?.type === "text") {
          output.push(
            new Paragraph({
              children: inlineRuns(
                first.type === "paragraph" ? (first as Tokens.Paragraph).tokens : [first],
              ),
              ...(list.ordered
                ? { numbering: { reference: "ordered-list", level: 0 } }
                : { bullet: { level: 0 } }),
            }),
          );
          for (const child of itemTokens.slice(1)) {
            if (child.type === "list") {
              output.push(...tokenToParagraphs(child));
            }
          }
        } else {
          for (const child of itemTokens) {
            output.push(...tokenToParagraphs(child));
          }
        }
      }
      return output;
    }
    case "code": {
      const code = token as Tokens.Code;
      return code.text.split("\n").map(
        (line) =>
          new Paragraph({
            shading: { fill: "F1EADB" },
            spacing: { after: 0, line: 300 },
            children: [
              new TextRun({ text: line || " ", font: "Consolas", size: 20, color: "2A251D" }),
            ],
          }),
      );
    }
    case "hr":
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: "· · ·", color: "8A7C66" })],
        }),
      ];
    case "table": {
      const table = token as Tokens.Table;
      const rows = [table.header, ...table.rows];
      return rows.map(
        (row) =>
          new Paragraph({
            children: [
              new TextRun({
                text: row.map((cell) => cell.text).join("  |  "),
                font: "Georgia",
                size: 22,
              }),
            ],
          }),
      );
    }
    case "html": {
      const html = token as Tokens.HTML;
      const text = html.text.replace(/<[^>]+>/g, "").trim();
      return text ? [new Paragraph({ children: [new TextRun(text)] })] : [];
    }
    case "text": {
      const text = token as Tokens.Text;
      return [new Paragraph({ children: inlineRuns(text.tokens ?? [text]) })];
    }
    default:
      return [];
  }
}

function inlineRuns(
  tokens: Token[] | undefined,
  options: { bold?: boolean; italics?: boolean; strike?: boolean } = {},
): TextRun[] {
  if (!tokens?.length) return [];
  const runs: TextRun[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const text = token as Tokens.Text;
        if (text.tokens?.length) {
          runs.push(...inlineRuns(text.tokens, options));
        } else {
          runs.push(new TextRun({ text: text.text, ...options }));
        }
        break;
      }
      case "escape": {
        const escape = token as Tokens.Escape;
        runs.push(new TextRun({ text: escape.text, ...options }));
        break;
      }
      case "strong": {
        const strong = token as Tokens.Strong;
        runs.push(...inlineRuns(strong.tokens, { ...options, bold: true }));
        break;
      }
      case "em": {
        const em = token as Tokens.Em;
        runs.push(...inlineRuns(em.tokens, { ...options, italics: true }));
        break;
      }
      case "codespan": {
        const code = token as Tokens.Codespan;
        runs.push(
          new TextRun({
            text: code.text,
            font: "Consolas",
            size: 21,
            ...options,
          }),
        );
        break;
      }
      case "del": {
        const del = token as Tokens.Del;
        runs.push(...inlineRuns(del.tokens, { ...options, strike: true }));
        break;
      }
      case "link": {
        const link = token as Tokens.Link;
        runs.push(...inlineRuns(link.tokens, options));
        break;
      }
      case "br":
        runs.push(new TextRun({ text: "", break: 1 }));
        break;
      case "image": {
        const image = token as Tokens.Image;
        runs.push(new TextRun({ text: image.text, ...options }));
        break;
      }
      default: {
        const raw = (token as Tokens.Generic).raw;
        if (raw) runs.push(new TextRun({ text: raw, ...options }));
      }
    }
  }
  return runs;
}
