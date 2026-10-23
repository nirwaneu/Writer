import { notFound } from "next/navigation";
import { getNovelDetail } from "@/lib/storage/novels";
import { getBookConfig } from "@/lib/storage/book-config";
import { BookDetailView } from "@/components/book/book-detail-view";
import { isAppError } from "@/lib/errors";
import type { NovelDetail } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let detail: NovelDetail | null = null;
  try {
    detail = await getNovelDetail(slug);
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }

  if (!detail) notFound();
  const book = await getBookConfig(slug).catch(() => null);

  return (
    <BookDetailView
      slug={slug}
      outline={detail.outline}
      wordCount={detail.wordCount}
      chapterCount={detail.chapterCount}
      presetName={book?.config.presetName}
    />
  );
}
