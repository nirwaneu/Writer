export type ReadingProgress = {
  chapter: number;
  page?: number;
};

const STORAGE_PREFIX = "vibedraft:reading-progress:";

function storageKey(slug: string): string {
  return `${STORAGE_PREFIX}${slug}`;
}

export function readReadingProgress(slug: string): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReadingProgress>;
    if (
      typeof parsed.chapter !== "number" ||
      !Number.isInteger(parsed.chapter) ||
      parsed.chapter < 1
    ) {
      return null;
    }
    return {
      chapter: parsed.chapter,
      ...(typeof parsed.page === "number" && Number.isInteger(parsed.page) && parsed.page >= 0
        ? { page: parsed.page }
        : {}),
    };
  } catch {
    return null;
  }
}

export function saveReadingProgress(slug: string, progress: ReadingProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(slug), JSON.stringify(progress));
  } catch {
    // Reading still works when localStorage is unavailable.
  }
}
