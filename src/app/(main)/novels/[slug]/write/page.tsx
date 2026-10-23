import { notFound } from "next/navigation";
import { getNovelDetail, getChapterContent } from "@/lib/storage/novels";
import { readNovelChat } from "@/lib/storage/chats";
import { getBookConfig } from "@/lib/storage/book-config";
import { getConfig } from "@/lib/storage/config";
import { isAppError } from "@/lib/errors";
import { WorkspaceView } from "@/components/workspace/workspace-view";
import type { ChatMessage, Outline } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  let outline: Outline | null = null;
  let chapterNumber = 1;
  let content = "";
  let messages: ChatMessage[] = [];

  try {
    const detail = await getNovelDetail(slug);
    outline = detail.outline;
    const requested = Number(query.chapter);
    chapterNumber = detail.outline.chapters.some((chapter) => chapter.number === requested)
      ? requested
      : detail.outline.currentChapter;

    const [chapterContent, chat] = await Promise.all([
      getChapterContent(slug, chapterNumber),
      readNovelChat(slug, chapterNumber),
    ]);
    content = chapterContent;
    messages = chat.messages;
  } catch (error) {
    if (isAppError(error) && error.status === 404) notFound();
    throw error;
  }

  if (!outline) notFound();

  const [book, global] = await Promise.all([getBookConfig(slug), getConfig()]);

  return (
    <WorkspaceView
      key={`${slug}-${chapterNumber}`}
      slug={slug}
      initialOutline={outline}
      chapterNumber={chapterNumber}
      initialContent={content}
      initialChatMessages={messages}
      plannerModel={book.config.models.planner}
      executorModel={book.config.models.executor}
      summarizerModel={book.config.models.summarizer}
      imageProviders={(global?.providers ?? []).map((provider) => ({
        id: provider.id,
        name: provider.name,
      }))}
    />
  );
}
