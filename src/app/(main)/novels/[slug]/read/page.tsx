import { notFound } from "next/navigation";
import { getChapterContent, getNovelDetail } from "@/lib/storage/novels";
import { ReaderView } from "@/components/reader/reader-view";
import { isAppError } from "@/lib/errors";
import type { Outline } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  let outline: Outline | null = null;
  let contents: Record<number, string> = {};
  let initial = 1;
  let hasExplicitChapter = false;

  try {
    const detail = await getNovelDetail(slug);
    outline = detail.outline;
    const entries = await Promise.all(
      detail.outline.chapters.map(async (chapter) => {
        const content = await getChapterContent(slug, chapter.number);
        return [chapter.number, content] as const;
      }),
    );
    contents = Object.fromEntries(entries) as Record<number, string>;
    const requested = Number(query.chapter);
    const requestedChapter = detail.outline.chapters.find(
      (chapter) => chapter.number === requested,
    );
    hasExplicitChapter = Boolean(requestedChapter);
    initial =
      requestedChapter?.number ?? detail.outline.chapters[0]?.number ?? 1;
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }

  if (!outline) notFound();

  return (
    <ReaderView
      key={`${slug}-${initial}`}
      slug={slug}
      outline={outline}
      contents={contents}
      initialChapter={initial}
      hasExplicitChapter={hasExplicitChapter}
    />
  );
}
