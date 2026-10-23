import type { Chapter } from "@/lib/schemas";

export function chapterDisplayNumber(chapter: Chapter): number {
  return chapter.chapterNumber ?? chapter.number;
}

export function isIllustrationChapter(chapter: Chapter | undefined): boolean {
  return chapter?.kind === "illustration";
}

export function pageKindLabel(chapter: Chapter): string {
  return chapter.kind === "illustration"
    ? "Illustration"
    : `Chapter ${chapterDisplayNumber(chapter)}`;
}

export function illustrationFilename(imagePath: string): string {
  const parts = imagePath.split(/[\\/]/);
  return parts[parts.length - 1] ?? imagePath;
}

export function illustrationUrl(slug: string, imagePath: string): string {
  return `/api/novels/${encodeURIComponent(slug)}/illustrations/${encodeURIComponent(
    illustrationFilename(imagePath),
  )}`;
}
