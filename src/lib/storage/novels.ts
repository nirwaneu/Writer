import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  type Chapter,
  type ChapterKind,
  type Character,
  type ImageAspectRatio,
  type NovelDetail,
  type NovelListItem,
  type Outline,
} from "@/lib/schemas";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import {
  books,
  chapters as chaptersTable,
  characters as charactersTable,
  chats as chatsTable,
  type DbChapter,
} from "@/lib/db/schema";
import {
  TRASH_DIR,
  assertChapterNumber,
  assertDraftId,
  assertSlug,
  chapterHistoryDir,
  chapterPath,
  illustrationPath,
  novelDir,
} from "@/lib/storage/paths";
import {
  moveDirectory,
  pathExists,
  readText,
  removeDirectory,
  withLock,
  writeTextAtomic,
} from "@/lib/storage/fs";
import { wordCount } from "@/lib/utils";
import { requireConfig } from "@/lib/storage/config";
import { createBookConfigSnapshot, resolvePreset } from "@/lib/presets/defaults";

const now = () => new Date().toISOString();

type BookRow = typeof books.$inferSelect;

function chapterFromRow(row: DbChapter, dynamicChapterNumber?: number): Chapter {
  const hasImage = Boolean(row.imagePath && row.imageProviderId && row.imageModel);
  const chapterNumber = dynamicChapterNumber ?? row.chapterNumber ?? undefined;
  return {
    number: row.number,
    title: row.title,
    summary: row.summary,
    status: row.status,
    wordCount: row.wordCount,
    summaryStale: row.summaryStale,
    updatedAt: row.updatedAt,
    ...(row.summaryUpdatedAt ? { summaryUpdatedAt: row.summaryUpdatedAt } : {}),
    kind: row.kind,
    ...(chapterNumber ? { chapterNumber } : {}),
    ...(hasImage
      ? {
          image: {
            path: row.imagePath as string,
            prompt: row.imagePrompt ?? "",
            negativePrompt: row.imageNegativePrompt ?? "",
            aspectRatio: (row.imageAspectRatio as ImageAspectRatio | null) ?? "portrait",
            providerId: row.imageProviderId as string,
            model: row.imageModel as string,
            updatedAt: row.imageUpdatedAt ?? row.updatedAt,
          },
        }
      : {}),
  };
}

function nextChapterNumber(
  pages: Array<{ number: number; chapterNumber: number | null; kind: ChapterKind }>,
): number {
  return pages.filter((page) => page.kind === "chapter").length + 1;
}

function chapterInsert(
  bookId: string,
  number: number,
  timestamp: string,
  kind: ChapterKind = "chapter",
  chapterNumber = number,
) {
  return {
    bookId,
    number,
    title: kind === "illustration" ? "Illustration" : `Chapter ${chapterNumber}`,
    summary: "",
    status: "planned" as const,
    wordCount: 0,
    summaryStale: false,
    updatedAt: timestamp,
    kind,
    chapterNumber: kind === "illustration" ? null : chapterNumber,
  };
}

async function getBookRowBySlug(slug: string): Promise<BookRow> {
  assertSlug(slug);
  const db = await getDb();
  const row = db
    .select()
    .from(books)
    .where(and(eq(books.slug, slug), eq(books.isDraft, false)))
    .get();
  if (!row) throw new NotFoundError("That book does not exist.");
  return row;
}

async function getDraftRow(id: string): Promise<BookRow> {
  assertDraftId(id);
  const db = await getDb();
  const row = db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.isDraft, true)))
    .get();
  if (!row) throw new NotFoundError("That draft does not exist.");
  return row;
}

async function loadChapters(bookId: string): Promise<Chapter[]> {
  const db = await getDb();
  const rows = db
    .select()
    .from(chaptersTable)
    .where(eq(chaptersTable.bookId, bookId))
    .orderBy(chaptersTable.number)
    .all();
  let chapterCount = 0;
  return rows.map((row) => {
    if (row.kind === "chapter") chapterCount += 1;
    return chapterFromRow(row, row.kind === "chapter" ? chapterCount : undefined);
  });
}

async function loadCharacters(bookId: string): Promise<Character[]> {
  const db = await getDb();
  return db
    .select()
    .from(charactersTable)
    .where(eq(charactersTable.bookId, bookId))
    .orderBy(charactersTable.sortOrder, charactersTable.id)
    .all()
    .map((row) => ({
      name: row.name,
      role: row.role,
      description: row.description,
    }));
}

function coverFromRow(row: BookRow) {
  if (!row.coverImagePath || !row.coverImageProviderId || !row.coverImageModel) {
    return undefined;
  }
  return {
    path: row.coverImagePath,
    prompt: row.coverImagePrompt ?? "",
    negativePrompt: row.coverImageNegativePrompt ?? "",
    aspectRatio: (row.coverImageAspectRatio as ImageAspectRatio | null) ?? "portrait",
    providerId: row.coverImageProviderId,
    model: row.coverImageModel,
    updatedAt: row.coverImageUpdatedAt ?? row.updatedAt,
  };
}

async function outlineForRow(row: BookRow): Promise<Outline> {
  const [bookChapters, bookCharacters] = await Promise.all([
    loadChapters(row.id),
    loadCharacters(row.id),
  ]);

  const numbers = new Set(bookChapters.map((chapter) => chapter.number));
  const lastChapter = [...bookChapters]
    .reverse()
    .find((chapter) => chapter.kind === "chapter");
  const currentChapter = numbers.has(row.currentChapter)
    ? row.currentChapter
    : lastChapter?.number ?? bookChapters[bookChapters.length - 1]?.number ?? 1;
  const cover = coverFromRow(row);

  return {
    version: 1,
    id: row.id,
    title: row.title,
    premise: row.premise,
    status: row.status,
    archived: row.isArchived,
    characters: bookCharacters,
    chapters: bookChapters,
    ...(cover ? { cover } : {}),
    currentChapter,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toListItem(row: {
  slug: string | null;
  title: string;
  premise: string;
  status: Outline["status"];
  archived: boolean;
  currentChapter: number;
  currentChapterNumber: number;
  wordCount: number | null;
  chapterCount: number | null;
  coverImagePath: string | null;
  updatedAt: string;
  createdAt: string;
}): NovelListItem {
  return {
    slug: row.slug ?? "",
    title: row.title,
    premise: row.premise,
    status: row.status,
    archived: row.archived,
    chapterCount: Number(row.chapterCount ?? 0),
    currentChapter: row.currentChapter,
    currentChapterNumber: Number(row.currentChapterNumber ?? row.currentChapter),
    wordCount: Number(row.wordCount ?? 0),
    ...(row.coverImagePath ? { coverImagePath: row.coverImagePath } : {}),
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

export async function listNovels(archived = false): Promise<NovelListItem[]> {
  const db = await getDb();
  const rows = db
    .select({
      slug: books.slug,
      title: books.title,
      premise: books.premise,
      status: books.status,
      archived: books.isArchived,
      currentChapter: books.currentChapter,
      coverImagePath: books.coverImagePath,
      createdAt: books.createdAt,
      updatedAt: books.updatedAt,
      chapterCount: sql<number>`(select count(*) from chapters where chapters.book_id = ${books.id} and chapters.kind = 'chapter')`,
      currentChapterNumber: sql<number>`(select count(*) from chapters where chapters.book_id = ${books.id} and chapters.kind = 'chapter' and chapters.number <= ${books.currentChapter})`,
      wordCount: sql<number>`(select coalesce(sum(word_count), 0) from chapters where chapters.book_id = ${books.id})`,
    })
    .from(books)
    .where(and(eq(books.isDraft, false), eq(books.isArchived, archived)))
    .orderBy(desc(books.updatedAt))
    .all();

  return rows.filter((row) => row.slug).map((row) => toListItem(row));
}

export async function listArchivedNovels(): Promise<NovelListItem[]> {
  return listNovels(true);
}

export async function setNovelArchived(
  slug: string,
  archived: boolean,
): Promise<Outline> {
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  db.update(books)
    .set({ isArchived: archived, updatedAt: now() })
    .where(eq(books.id, row.id))
    .run();
  return getNovel(slug);
}

export async function getNovel(slug: string): Promise<Outline> {
  return outlineForRow(await getBookRowBySlug(slug));
}

export async function getNovelDetail(slug: string): Promise<NovelDetail> {
  const outline = await getNovel(slug);
  return {
    slug,
    outline,
    chapterCount: outline.chapters.filter((chapter) => chapter.kind === "chapter").length,
    wordCount: outline.chapters.reduce((total, chapter) => total + chapter.wordCount, 0),
  };
}

export async function uniqueSlug(title: string): Promise<string> {
  const db = await getDb();
  const base =
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 56) || "untitled-novel";

  for (let attempt = 1; attempt < 100; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const existing = db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.slug, candidate))
      .get();
    if (!existing) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

export async function createDraft(
  presetId?: string,
): Promise<{ id: string; outline: Outline }> {
  const global = await requireConfig();
  const preset = resolvePreset(global, presetId ?? global.defaultPresetId);
  const config = createBookConfigSnapshot(preset, global.models);
  const db = await getDb();
  const id = randomUUID();
  const timestamp = now();

  db.transaction((tx) => {
    tx.insert(books)
      .values({
        id,
        slug: null,
        title: "Untitled Novel",
        premise: "",
        status: "brainstorming",
        isDraft: true,
        currentChapter: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        presetId: config.presetId,
        presetName: config.presetName,
        plannerModel: config.models.planner,
        executorModel: config.models.executor,
        summarizerModel: config.models.summarizer,
        imagePrompterModel: config.models.imagePrompter,
        rolesJson: config.roles,
        configCreatedAt: config.createdAt,
        configUpdatedAt: config.updatedAt,
      })
      .run();
    tx.insert(chaptersTable).values(chapterInsert(id, 1, timestamp, "chapter", 1)).run();
    tx.insert(chatsTable)
      .values({
        bookId: id,
        scope: "premise",
        messagesJson: [],
        updatedAt: timestamp,
      })
      .run();
  });

  const row = await getDraftRow(id);
  return { id, outline: await outlineForRow(row) };
}

export async function getDraft(id: string): Promise<Outline> {
  return outlineForRow(await getDraftRow(id));
}

export async function publishDraft(
  id: string,
  input: { title: string; premise: string },
): Promise<{ slug: string; outline: Outline }> {
  await getDraftRow(id);
  const title = cleanTitle(input.title);
  const premise = input.premise.trim();
  if (!premise) {
    throw new AppError("BAD_REQUEST", "The premise is empty. Try the summarizer again.", {
      status: 400,
    });
  }

  return withLock(`book:${id}`, async () => {
    const slug = await uniqueSlug(title);
    const timestamp = now();
    const db = await getDb();
    db.update(books)
      .set({
        slug,
        title,
        premise,
        status: "active",
        isDraft: false,
        currentChapter: 1,
        updatedAt: timestamp,
      })
      .where(eq(books.id, id))
      .run();

    const existingChapters = db
      .select({ number: chaptersTable.number })
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, id))
      .all();
    if (!existingChapters.length) {
      db.insert(chaptersTable).values(chapterInsert(id, 1, timestamp, "chapter", 1)).run();
    }
    db.insert(chatsTable)
      .values({
        bookId: id,
        scope: "chapter_1",
        messagesJson: [],
        updatedAt: timestamp,
      })
      .onConflictDoNothing()
      .run();

    await fs.mkdir(path.join(novelDir(slug), "chapters"), { recursive: true });
    return { slug, outline: await getNovel(slug) };
  });
}

function cleanTitle(value: string): string {
  const cleaned = value
    .replace(/^["'#*\s]+|["'#*\s]+$/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
  return cleaned || "Untitled Novel";
}

export async function updateNovelMeta(
  slug: string,
  patch: { title?: string; premise?: string; status?: Outline["status"] },
): Promise<Outline> {
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  db.update(books)
    .set({
      title: patch.title ? cleanTitle(patch.title) : row.title,
      premise: patch.premise !== undefined ? patch.premise.trim() : row.premise,
      status: patch.status ?? row.status,
      updatedAt: now(),
    })
    .where(eq(books.id, row.id))
    .run();
  return getNovel(slug);
}

export async function deleteNovel(slug: string): Promise<void> {
  const row = await getBookRowBySlug(slug);
  const source = novelDir(slug);
  if (await pathExists(source)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await moveDirectory(source, path.join(TRASH_DIR, `${slug}-${stamp}`));
  }
  const db = await getDb();
  db.delete(books).where(eq(books.id, row.id)).run();
}

export async function deleteNovelPermanently(slug: string): Promise<void> {
  const row = await getBookRowBySlug(slug);
  await removeDirectory(novelDir(slug));
  const db = await getDb();
  db.delete(books).where(eq(books.id, row.id)).run();
}

export async function discardDraft(id: string): Promise<void> {
  const row = await getDraftRow(id);
  const db = await getDb();
  db.delete(books).where(eq(books.id, row.id)).run();
}

export async function ensureChapter(slug: string, number: number): Promise<Outline> {
  assertChapterNumber(number);
  const row = await getBookRowBySlug(slug);
  return withLock(`book:${row.id}`, async () => {
    const db = await getDb();
    const existing = db
      .select({ number: chaptersTable.number })
      .from(chaptersTable)
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .get();

    if (!existing) {
      const timestamp = now();
      const chapterNumber = nextChapterNumber(
        db
          .select({
            number: chaptersTable.number,
            chapterNumber: chaptersTable.chapterNumber,
            kind: chaptersTable.kind,
          })
          .from(chaptersTable)
          .where(eq(chaptersTable.bookId, row.id))
          .all(),
      );
      db.transaction((tx) => {
        tx.insert(chaptersTable)
          .values(chapterInsert(row.id, number, timestamp, "chapter", chapterNumber))
          .run();
        tx.insert(chatsTable)
          .values({
            bookId: row.id,
            scope: `chapter_${number}`,
            messagesJson: [],
            updatedAt: timestamp,
          })
          .onConflictDoNothing()
          .run();
        tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
      });
    } else {
      db.insert(chatsTable)
        .values({
          bookId: row.id,
          scope: `chapter_${number}`,
          messagesJson: [],
          updatedAt: now(),
        })
        .onConflictDoNothing()
        .run();
    }

    return getNovel(slug);
  });
}

export async function getChapterContent(slug: string, number: number): Promise<string> {
  assertChapterNumber(number);
  return readText(chapterPath(slug, number), "");
}

async function snapshotChapter(slug: string, number: number, content: string): Promise<void> {
  if (!content.trim()) return;
  const dir = chapterHistoryDir(slug, number);
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(path.join(dir, `${stamp}.md`), content, "utf8");
  const files = (await fs.readdir(dir)).filter((name) => name.endsWith(".md")).sort();
  const excess = files.slice(0, Math.max(0, files.length - 40));
  await Promise.all(excess.map((name) => fs.rm(path.join(dir, name), { force: true })));
}

export async function saveChapterContent(
  slug: string,
  number: number,
  content: string,
  expectedUpdatedAt?: string,
): Promise<Chapter> {
  assertChapterNumber(number);
  const row = await getBookRowBySlug(slug);
  return withLock(`book:${row.id}`, async () => {
    const db = await getDb();
    const existing = db
      .select()
      .from(chaptersTable)
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .get();
    if (!existing) throw new NotFoundError(`Chapter ${number} does not exist.`);
    if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) {
      throw new ConflictError(
        "This chapter changed in another tab. Reload before saving.",
        { currentUpdatedAt: existing.updatedAt },
      );
    }

    const previous = await readText(chapterPath(slug, number), "");
    if (previous !== content) {
      await snapshotChapter(slug, number, previous);
      await writeTextAtomic(chapterPath(slug, number), content);
    }

    const hasContent = Boolean(content.trim());
    const summaryExists = Boolean(existing.summary.trim());
    const timestamp = now();
    const status: Chapter["status"] = hasContent
      ? summaryExists
        ? "drafted"
        : "drafted"
      : "planned";
    const summaryStale = hasContent && summaryExists ? true : existing.summaryStale;
    const chapter: Chapter = {
      ...chapterFromRow(existing),
      status,
      wordCount: wordCount(content),
      summaryStale,
      updatedAt: timestamp,
    };

    db.transaction((tx) => {
      tx.update(chaptersTable)
        .set({
          wordCount: chapter.wordCount,
          status: chapter.status,
          summaryStale: chapter.summaryStale,
          updatedAt: timestamp,
        })
        .where(
          and(
            eq(chaptersTable.bookId, row.id),
            eq(chaptersTable.number, number),
          ),
        )
        .run();
      tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
    });

    const saved = await loadChapters(row.id);
    return saved.find((item) => item.number === number) ?? chapter;
  });
}

export async function updateChapterTitle(
  slug: string,
  number: number,
  title: string,
): Promise<Outline> {
  assertChapterNumber(number);
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    tx.update(chaptersTable)
      .set({ title: title.trim().slice(0, 200), updatedAt: timestamp })
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .run();
    tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
  });
  return getNovel(slug);
}

export async function saveChapterSummary(
  slug: string,
  number: number,
  summary: string,
  title?: string,
): Promise<Outline> {
  assertChapterNumber(number);
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    tx.update(chaptersTable)
      .set({
        summary: summary.trim(),
        status: "summarized",
        summaryStale: false,
        summaryUpdatedAt: timestamp,
        ...(title?.trim() ? { title: title.trim().slice(0, 200) } : {}),
      })
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .run();
    tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
  });
  return getNovel(slug);
}

export async function markSummaryFailed(slug: string, number: number): Promise<Outline> {
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    tx.update(chaptersTable)
      .set({ status: "summary_failed", summaryStale: true })
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .run();
    tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
  });
  return getNovel(slug);
}

export async function skipChapterSummary(slug: string, number: number): Promise<Outline> {
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    tx.update(chaptersTable)
      .set({ status: "summary_skipped", summaryStale: false })
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .run();
    tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
  });
  return getNovel(slug);
}

export async function advanceChapter(slug: string, from: number): Promise<Outline> {
  assertChapterNumber(from);
  const row = await getBookRowBySlug(slug);
  return withLock(`book:${row.id}`, async () => {
    const db = await getDb();
    const current = db
      .select()
      .from(chaptersTable)
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, from),
        ),
      )
      .get();
    if (!current) throw new NotFoundError(`Chapter ${from} does not exist.`);
    if (current.status !== "summarized" && current.status !== "summary_skipped") {
      throw new AppError(
        "CONFLICT",
        "Summarize this chapter, or explicitly skip its summary, before continuing.",
        { status: 409, retryable: false },
      );
    }

    const pages = db
      .select({
        number: chaptersTable.number,
        chapterNumber: chaptersTable.chapterNumber,
        kind: chaptersTable.kind,
      })
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, row.id))
      .orderBy(chaptersTable.number)
      .all();
    const existingNext = pages.find(
      (page) => page.kind === "chapter" && page.number > from,
    );
    const timestamp = now();
    if (existingNext) {
      db.update(books)
        .set({ currentChapter: existingNext.number, status: "active", updatedAt: timestamp })
        .where(eq(books.id, row.id))
        .run();
      return getNovel(slug);
    }

    const nextNumber = Math.max(from, ...pages.map((page) => page.number)) + 1;
    const logicalChapterNumber = nextChapterNumber(pages);
    db.transaction((tx) => {
      tx.insert(chaptersTable)
        .values(
          chapterInsert(
            row.id,
            nextNumber,
            timestamp,
            "chapter",
            logicalChapterNumber,
          ),
        )
        .onConflictDoNothing()
        .run();
      tx.insert(chatsTable)
        .values({
          bookId: row.id,
          scope: `chapter_${nextNumber}`,
          messagesJson: [],
          updatedAt: timestamp,
        })
        .onConflictDoNothing()
        .run();
      tx.update(books)
        .set({
          currentChapter: nextNumber,
          status: "active",
          updatedAt: timestamp,
        })
        .where(eq(books.id, row.id))
        .run();
    });

    return getNovel(slug);
  });
}

export async function saveCharacters(
  slug: string,
  characters: Character[],
): Promise<Outline> {
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const timestamp = now();
  db.transaction((tx) => {
    tx.delete(charactersTable).where(eq(charactersTable.bookId, row.id)).run();
    characters.forEach((character, index) => {
      tx.insert(charactersTable)
        .values({
          bookId: row.id,
          name: character.name,
          role: character.role,
          description: character.description,
          sortOrder: index,
        })
        .run();
    });
    tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
  });
  return getNovel(slug);
}

export async function deletePage(slug: string, number: number): Promise<Outline> {
  assertChapterNumber(number);
  const row = await getBookRowBySlug(slug);
  return withLock(`book:${row.id}`, async () => {
    const db = await getDb();
    const pages = db
      .select()
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, row.id))
      .orderBy(chaptersTable.number)
      .all();
    const target = pages.find((page) => page.number === number);
    if (!target) throw new NotFoundError(`Page ${number} does not exist.`);
    if (pages.length <= 1) {
      throw new AppError("BAD_REQUEST", "A book needs at least one page.", { status: 400 });
    }

    const remaining = pages.filter((page) => page.number !== number);
    const fallbackCurrent =
      remaining.find((page) => page.number === row.currentChapter) ??
      [...remaining].reverse().find((page) => page.kind === "chapter") ??
      remaining[remaining.length - 1];
    const timestamp = now();

    db.transaction((tx) => {
      if (target.kind === "chapter") {
        tx.delete(chatsTable)
          .where(
            and(
              eq(chatsTable.bookId, row.id),
              eq(chatsTable.scope, `chapter_${number}`),
            ),
          )
          .run();
      }
      tx.delete(chaptersTable)
        .where(
          and(
            eq(chaptersTable.bookId, row.id),
            eq(chaptersTable.number, number),
          ),
        )
        .run();
      tx.update(books)
        .set({
          currentChapter: fallbackCurrent?.number ?? 1,
          updatedAt: timestamp,
        })
        .where(eq(books.id, row.id))
        .run();
    });

    await fs.rm(chapterPath(slug, number), { force: true }).catch(() => undefined);
    await fs
      .rm(chapterHistoryDir(slug, number), { recursive: true, force: true })
      .catch(() => undefined);
    if (target.kind === "illustration" && target.imagePath) {
      await fs
        .rm(illustrationPath(slug, target.imagePath), { force: true })
        .catch(() => undefined);
    }

    return getNovel(slug);
  });
}

export async function saveCoverResult(
  slug: string,
  input: {
    path: string;
    prompt: string;
    negativePrompt: string;
    aspectRatio: ImageAspectRatio;
    providerId: string;
    model: string;
  },
): Promise<Outline> {
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const timestamp = now();
  db.update(books)
    .set({
      coverImagePath: input.path,
      coverImagePrompt: input.prompt,
      coverImageNegativePrompt: input.negativePrompt,
      coverImageAspectRatio: input.aspectRatio,
      coverImageProviderId: input.providerId,
      coverImageModel: input.model,
      coverImageUpdatedAt: timestamp,
      updatedAt: timestamp,
    })
    .where(eq(books.id, row.id))
    .run();
  return getNovel(slug);
}

export async function addPage(
  slug: string,
  kind: ChapterKind,
): Promise<{ outline: Outline; pageNumber: number }> {
  const row = await getBookRowBySlug(slug);
  return withLock(`book:${row.id}`, async () => {
    const db = await getDb();
    const pages = db
      .select({
        number: chaptersTable.number,
        chapterNumber: chaptersTable.chapterNumber,
        kind: chaptersTable.kind,
      })
      .from(chaptersTable)
      .where(eq(chaptersTable.bookId, row.id))
      .all();
    const pageNumber = Math.max(0, ...pages.map((page) => page.number)) + 1;
    const chapterNumber = nextChapterNumber(pages);
    const timestamp = now();

    db.transaction((tx) => {
      tx.insert(chaptersTable)
        .values(
          chapterInsert(row.id, pageNumber, timestamp, kind, chapterNumber),
        )
        .run();
      if (kind === "chapter") {
        tx.insert(chatsTable)
          .values({
            bookId: row.id,
            scope: `chapter_${pageNumber}`,
            messagesJson: [],
            updatedAt: timestamp,
          })
          .onConflictDoNothing()
          .run();
      }
      tx.update(books)
        .set({
          currentChapter: pageNumber,
          status: "active",
          updatedAt: timestamp,
        })
        .where(eq(books.id, row.id))
        .run();
    });

    return { outline: await getNovel(slug), pageNumber };
  });
}

export async function saveIllustrationResult(
  slug: string,
  number: number,
  input: {
    path: string;
    prompt: string;
    negativePrompt: string;
    aspectRatio: ImageAspectRatio;
    providerId: string;
    model: string;
  },
): Promise<Outline> {
  assertChapterNumber(number);
  const row = await getBookRowBySlug(slug);
  const db = await getDb();
  const existing = db
    .select()
    .from(chaptersTable)
    .where(
      and(
        eq(chaptersTable.bookId, row.id),
        eq(chaptersTable.number, number),
      ),
    )
    .get();
  if (!existing) throw new NotFoundError(`Page ${number} does not exist.`);
  if (existing.kind !== "illustration") {
    throw new AppError("BAD_REQUEST", "Only illustration pages can hold images.", {
      status: 400,
    });
  }

  const timestamp = now();
  db.transaction((tx) => {
    tx.update(chaptersTable)
      .set({
        title: existing.title,
        imagePath: input.path,
        imagePrompt: input.prompt,
        imageNegativePrompt: input.negativePrompt,
        imageAspectRatio: input.aspectRatio,
        imageProviderId: input.providerId,
        imageModel: input.model,
        imageUpdatedAt: timestamp,
        updatedAt: timestamp,
      })
      .where(
        and(
          eq(chaptersTable.bookId, row.id),
          eq(chaptersTable.number, number),
        ),
      )
      .run();
    tx.update(books).set({ updatedAt: timestamp }).where(eq(books.id, row.id)).run();
  });
  return getNovel(slug);
}

export async function getChapterHistory(slug: string, number: number) {
  const dir = chapterHistoryDir(slug, number);
  try {
    return (await fs.readdir(dir)).filter((name) => name.endsWith(".md")).sort().reverse();
  } catch {
    return [];
  }
}

export async function getChapterVersion(slug: string, number: number, version: string) {
  if (!/^[0-9TZ.-]+\.md$/.test(version)) {
    throw new AppError("BAD_REQUEST", "Invalid version.", { status: 400 });
  }
  const target = path.join(chapterHistoryDir(slug, number), version);
  if (!(await pathExists(target))) throw new NotFoundError("That version does not exist.");
  return readText(target);
}
