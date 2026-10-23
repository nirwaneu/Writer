import path from "node:path";
import { AppError } from "@/lib/errors";

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

export const NOVELS_DIR = path.join(DATA_DIR, "novels");
export const DRAFTS_DIR = path.join(NOVELS_DIR, ".drafts");
export const TRASH_DIR = path.join(NOVELS_DIR, ".trash");
export const CONFIG_PATH = path.join(DATA_DIR, "app_config.json");
export const DB_PATH = path.join(DATA_DIR, "vibedraft.db");

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const DRAFT_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertSlug(slug: string): string {
  if (!SLUG_PATTERN.test(slug)) {
    throw new AppError("BAD_REQUEST", "Invalid book identifier.", { status: 400 });
  }
  return slug;
}

export function assertDraftId(id: string): string {
  if (!DRAFT_PATTERN.test(id)) {
    throw new AppError("BAD_REQUEST", "Invalid draft identifier.", { status: 400 });
  }
  return id;
}

export function assertChapterNumber(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 500) {
    throw new AppError("BAD_REQUEST", "Invalid chapter number.", { status: 400 });
  }
  return value;
}

export function assertInside(root: string, target: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(target);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new AppError("BAD_REQUEST", "Invalid path.", { status: 400 });
  }
  return resolved;
}

export function novelDir(slug: string): string {
  return assertInside(NOVELS_DIR, path.join(NOVELS_DIR, assertSlug(slug)));
}

export function draftDir(id: string): string {
  return assertInside(DRAFTS_DIR, path.join(DRAFTS_DIR, assertDraftId(id)));
}

export function outlinePath(slug: string): string {
  return path.join(novelDir(slug), "outline.json");
}

export function bookConfigPath(slug: string): string {
  return path.join(novelDir(slug), "book_config.json");
}

export function chaptersDir(slug: string): string {
  return path.join(novelDir(slug), "chapters");
}

export function chapterPath(slug: string, chapter: number): string {
  return path.join(chaptersDir(slug), `chapter_${assertChapterNumber(chapter)}.md`);
}

export function chapterHistoryDir(slug: string, chapter: number): string {
  return path.join(chaptersDir(slug), ".history", `chapter_${assertChapterNumber(chapter)}`);
}

export function chatsDir(slug: string): string {
  return path.join(novelDir(slug), "chats");
}

export function chatPath(slug: string, scope: "premise" | number): string {
  const name = scope === "premise" ? "premise_chat.json" : `chapter_${assertChapterNumber(scope)}_chat.json`;
  return path.join(chatsDir(slug), name);
}

export function draftOutlinePath(id: string): string {
  return path.join(draftDir(id), "outline.json");
}

export function draftBookConfigPath(id: string): string {
  return path.join(draftDir(id), "book_config.json");
}

export function draftChatPath(id: string, scope: "premise" | number): string {
  const name = scope === "premise" ? "premise_chat.json" : `chapter_${assertChapterNumber(scope)}_chat.json`;
  return path.join(draftDir(id), "chats", name);
}
