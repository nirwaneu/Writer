import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import { errorResponse } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getChapterContent, getNovel } from "@/lib/storage/novels";
import { chapterDisplayNumber } from "@/lib/pages";
import { buildDocx } from "@/lib/export/docx";
import type { Outline } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") || "md").toLowerCase();
    const chapterParam = url.searchParams.get("chapter");
    const outline = await getNovel(slug);

    if (!["md", "html", "docx"].includes(format)) {
      throw new AppError("BAD_REQUEST", "Choose md, html, or docx.", { status: 400 });
    }

    let chapters = outline.chapters;
    if (chapterParam) {
      const number = Number(chapterParam);
      const chapter = outline.chapters.find((item) => item.number === number);
      if (!chapter) throw new AppError("NOT_FOUND", "That chapter does not exist.", { status: 404 });
      chapters = [chapter];
    }

    const withContent = (
      await Promise.all(
        chapters.map(async (chapter) => ({
          chapter,
          markdown: (await getChapterContent(slug, chapter.number)).trim(),
        })),
      )
    ).filter((entry) => entry.markdown.length > 0);

    if (!withContent.length) {
      throw new AppError(
        "BAD_REQUEST",
        chapterParam
          ? "This chapter has no text to export yet."
          : "This book has no drafted chapters to export yet.",
        { status: 400 },
      );
    }

    const base = chapterParam ? `${slug}-chapter-${chapterParam}` : slug;

    if (format === "md") {
      return textResponse(buildMarkdown(outline, withContent), `${base}.md`, "text/markdown; charset=utf-8");
    }

    if (format === "html") {
      return textResponse(
        await buildHtml(outline, withContent),
        `${base}.html`,
        "text/html; charset=utf-8",
      );
    }

    const buffer = await buildDocx(
      outline,
      withContent.map((entry) => ({
        number: chapterDisplayNumber(entry.chapter),
        title: entry.chapter.title,
        markdown: entry.markdown,
      })),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${base}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function textResponse(body: string, filename: string, contentType: string) {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildMarkdown(
  outline: Outline,
  entries: Array<{ chapter: Outline["chapters"][number]; markdown: string }>,
): string {
  const lines: string[] = [`# ${outline.title}`, ""];
  if (entries.length > 1 && outline.premise.trim()) {
    lines.push(`> ${outline.premise.replace(/\n/g, "\n> ")}`, "");
  }
  for (const entry of entries) {
    lines.push(
      `## Chapter ${chapterDisplayNumber(entry.chapter)} — ${entry.chapter.title}`,
      "",
      entry.markdown,
      "",
    );
  }
  return lines.join("\n");
}

async function buildHtml(
  outline: Outline,
  entries: Array<{ chapter: Outline["chapters"][number]; markdown: string }>,
): Promise<string> {
  const rendered = await Promise.all(
    entries.map(async (entry) => {
      const html = await marked.parse(entry.markdown, { gfm: true });
      return `<section class="chapter"><h2>Chapter ${chapterDisplayNumber(entry.chapter)} — ${escapeHtml(
        entry.chapter.title,
      )}</h2>${sanitizeHtml(html, {
        allowedTags: [
          "p",
          "br",
          "em",
          "strong",
          "del",
          "code",
          "pre",
          "blockquote",
          "ul",
          "ol",
          "li",
          "hr",
          "a",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
        ],
        allowedAttributes: { a: ["href", "title"] },
        allowedSchemes: ["http", "https", "mailto"],
      })}</section>`;
    }),
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(outline.title)}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; background: #f5eedf; color: #1a1712; font-family: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif; line-height: 1.75; }
  main { max-width: 68ch; margin: 0 auto; padding: 4rem 1.5rem 6rem; }
  h1 { font-size: 2.6rem; line-height: 1.08; margin: 0 0 0.5rem; }
  h2 { font-size: 1.6rem; margin: 3.5rem 0 1.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #ded3bf; }
  p { margin: 0 0 1.05em; }
  blockquote { margin: 1.5em 0; padding-left: 1em; border-left: 2px solid #c9b48d; color: #4d4539; font-style: italic; }
  hr { border: 0; text-align: center; margin: 2.2em 0; }
  hr::after { content: "· · ·"; letter-spacing: 0.6em; color: #a3957d; }
  code { font-family: Consolas, monospace; font-size: 0.85em; background: #e9dfcc; padding: 0.1em 0.3em; }
  pre { background: #e9dfcc; padding: 1em; overflow-x: auto; }
  a { color: #8a520f; }
  .premise { color: #5f5546; font-style: italic; max-width: 55ch; }
  @media print { body { background: #fff; } main { padding: 0; } h2 { page-break-before: always; } h2:first-of-type { page-break-before: auto; } }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(outline.title)}</h1>
${entries.length > 1 && outline.premise ? `<p class="premise">${escapeHtml(outline.premise)}</p>` : ""}
${rendered.join("\n")}
</main>
</body>
</html>`;
}
