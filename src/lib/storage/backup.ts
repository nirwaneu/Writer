import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  books,
  chapters as chaptersTable,
  characters as charactersTable,
  chats as chatsTable,
} from "@/lib/db/schema";
import { AppError } from "@/lib/errors";
import { chapterSchema, characterSchema, chatMessageSchema, modelRolesSchema, presetRolesSchema } from "@/lib/schemas";
import { getBookConfig } from "@/lib/storage/book-config";
import {
  getChapterContent,
  getNovel,
  uniqueSlug,
} from "@/lib/storage/novels";
import { chapterPath, novelDir } from "@/lib/storage/paths";
import { removeDirectory, writeTextAtomic } from "@/lib/storage/fs";

const now = () => new Date().toISOString();

const backupBookSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    premise: z.string().max(200_000).default(""),
    status: z.enum(["brainstorming", "active", "complete"]).default("active"),
    currentChapter: z.number().int().positive().default(1),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();

const backupConfigSchema = z
  .object({
    presetId: z.string().min(1).max(100),
    presetName: z.string().trim().min(1).max(80),
    models: modelRolesSchema,
    roles: presetRolesSchema,
  })
  .strict();

const backupChapterSchema = chapterSchema
  .omit({ image: true })
  .extend({
    content: z.string().max(2_000_000).default(""),
  })
  .strict();

const backupChatSchema = z
  .object({
    scope: z.union([z.literal("premise"), z.number().int().positive().max(500)]),
    messages: z.array(chatMessageSchema).max(2_000),
    updatedAt: z.string().min(1),
  })
  .strict();

export const bookBackupSchema = z
  .object({
    format: z.literal("vibedraft-book-backup"),
    version: z.literal(1),
    exportedAt: z.string().min(1),
    book: backupBookSchema,
    config: backupConfigSchema,
    chapters: z
      .array(backupChapterSchema)
      .max(500)
      .refine(
        (items) => new Set(items.map((item) => item.number)).size === items.length,
        "Chapter numbers must be unique.",
      ),
    characters: z.array(characterSchema).max(100),
    chats: z
      .array(backupChatSchema)
      .max(500)
      .refine(
        (items) => new Set(items.map((item) => String(item.scope))).size === items.length,
        "Chat scopes must be unique.",
      ),
  })
  .strict();

export type BookBackup = z.infer<typeof bookBackupSchema>;

function scopeFromKey(scope: string): "premise" | number | null {
  if (scope === "premise") return "premise";
  const match = /^chapter_(\d+)$/.exec(scope);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export async function exportBookBackup(slug: string): Promise<BookBackup> {
  const outline = await getNovel(slug);
  const config = (await getBookConfig(slug)).config;
  const db = await getDb();
  const bookRow = db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.slug, slug))
    .get();
  if (!bookRow) throw new AppError("NOT_FOUND", "That book does not exist.", { status: 404 });

  const chatRows = db
    .select()
    .from(chatsTable)
    .where(eq(chatsTable.bookId, bookRow.id))
    .all();

  const chapters = await Promise.all(
    outline.chapters.map(async (chapter) => {
      const { image, ...metadata } = chapter;
      void image;
      return {
        ...metadata,
        content: await getChapterContent(slug, chapter.number),
      };
    }),
  );

  const chats: BookBackup["chats"] = [];
  for (const row of chatRows) {
    const scope = scopeFromKey(row.scope);
    if (scope === null) continue;
    chats.push({
      scope,
      messages: row.messagesJson ?? [],
      updatedAt: row.updatedAt,
    });
  }

  return {
    format: "vibedraft-book-backup",
    version: 1,
    exportedAt: now(),
    book: {
      title: outline.title,
      premise: outline.premise,
      status: outline.status,
      currentChapter: outline.currentChapter,
      createdAt: outline.createdAt,
      updatedAt: outline.updatedAt,
    },
    config: {
      presetId: config.presetId,
      presetName: config.presetName,
      models: config.models,
      roles: config.roles,
    },
    chapters,
    characters: outline.characters,
    chats,
  };
}

export async function importBookBackup(input: BookBackup): Promise<{ slug: string; outline: Awaited<ReturnType<typeof getNovel>> }> {
  const db = await getDb();
  const bookId = randomUUID();
  const slug = await uniqueSlug(input.book.title);
  const pageNumbers = new Set(input.chapters.map((chapter) => chapter.number));
  const validChatScopes = new Set(["premise", ...input.chapters.map((chapter) => String(chapter.number))]);
  for (const chat of input.chats) {
    if (!validChatScopes.has(String(chat.scope))) {
      throw new AppError("BAD_REQUEST", "The backup contains a chat for an unknown page.", {
        status: 400,
      });
    }
  }

  const sortedChapters = [...input.chapters].sort((a, b) => a.number - b.number);
  const currentChapter = pageNumbers.has(input.book.currentChapter)
    ? input.book.currentChapter
    : sortedChapters.filter((chapter) => chapter.kind === "chapter").at(-1)?.number ??
      sortedChapters.at(-1)?.number ??
      1;

  let textChapterCount = 0;
  const chapterRows = sortedChapters.map((chapter) => {
    if (chapter.kind === "chapter") textChapterCount += 1;
    return {
      bookId,
      number: chapter.number,
      title: chapter.title,
      summary: chapter.summary,
      status: chapter.status,
      wordCount: chapter.wordCount,
      summaryStale: chapter.summaryStale,
      updatedAt: chapter.updatedAt,
      summaryUpdatedAt: chapter.summaryUpdatedAt ?? null,
      kind: chapter.kind,
      chapterNumber: chapter.kind === "chapter" ? textChapterCount : null,
      imagePath: null,
      imagePrompt: null,
      imageNegativePrompt: null,
      imageAspectRatio: null,
      imageProviderId: null,
      imageModel: null,
      imageUpdatedAt: null,
    };
  });

  let committed = false;
  try {
    await fs.mkdir(novelDir(slug), { recursive: true });
    for (const chapter of sortedChapters) {
      if (chapter.kind !== "chapter" || !chapter.content) continue;
      await writeTextAtomic(chapterPath(slug, chapter.number), chapter.content);
    }

    db.transaction((tx) => {
      tx.insert(books)
        .values({
          id: bookId,
          slug,
          title: input.book.title,
          premise: input.book.premise,
          status: input.book.status === "complete" ? "complete" : "active",
          isDraft: false,
          isArchived: false,
          currentChapter,
          createdAt: input.book.createdAt,
          updatedAt: input.book.updatedAt,
          presetId: input.config.presetId,
          presetName: input.config.presetName,
          plannerModel: input.config.models.planner,
          executorModel: input.config.models.executor,
          summarizerModel: input.config.models.summarizer,
          imagePrompterModel: input.config.models.imagePrompter,
          rolesJson: input.config.roles,
          configCreatedAt: input.book.createdAt,
          configUpdatedAt: input.book.updatedAt,
        })
        .run();

      for (const chapter of chapterRows) {
        tx.insert(chaptersTable).values(chapter).run();
      }

      for (const [index, character] of input.characters.entries()) {
        tx.insert(charactersTable)
          .values({
            bookId,
            name: character.name,
            role: character.role,
            description: character.description,
            sortOrder: index,
          })
          .run();
      }

      for (const chat of input.chats) {
        tx.insert(chatsTable)
          .values({
            bookId,
            scope: chat.scope === "premise" ? "premise" : `chapter_${chat.scope}`,
            messagesJson: chat.messages,
            updatedAt: chat.updatedAt,
          })
          .run();
      }
    });

    committed = true;
    return { slug, outline: await getNovel(slug) };
  } catch (error) {
    if (!committed) {
      await removeDirectory(novelDir(slug)).catch(() => undefined);
    }
    throw error;
  }
}
