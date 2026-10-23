import type { Chapter, ChapterStatus } from "@/lib/schemas";

export function chapterStatusMeta(
  status: ChapterStatus,
  summaryStale = false,
): { label: string; tone: "muted" | "amber" | "success" | "danger" } {
  if (summaryStale && (status === "summarized" || status === "drafted")) {
    return { label: "Summary stale", tone: "danger" };
  }
  switch (status) {
    case "planned":
      return { label: "Planned", tone: "muted" };
    case "drafted":
      return { label: "Drafted", tone: "amber" };
    case "summarized":
      return { label: "In vault", tone: "success" };
    case "summary_failed":
      return { label: "Summary failed", tone: "danger" };
    case "summary_skipped":
      return { label: "Summary skipped", tone: "amber" };
  }
}

export function isChapterReadyToContinue(chapter: Chapter | undefined): boolean {
  if (!chapter) return false;
  return (
    (chapter.status === "summarized" && !chapter.summaryStale) ||
    chapter.status === "summary_skipped"
  );
}
