import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import {
  appConfigSchema,
  bookConfigSchema,
  chatSchema,
  outlineSchema,
  type BookConfig,
} from "@/lib/schemas";
import { normalizeConfig } from "@/lib/presets/defaults";
import {
  CONFIG_PATH,
  DRAFTS_DIR,
  NOVELS_DIR,
  bookConfigPath,
  chatsDir,
  draftBookConfigPath,
  draftDir,
  draftOutlinePath,
  outlinePath,
} from "@/lib/storage/paths";
import { listDirectories, pathExists, readJson } from "@/lib/storage/fs";

type AppDb = BetterSQLite3Database<typeof schema>;

const MIGRATION_KEY = "legacy_files_migrated";

function scopeKey(scope: "premise" | number): string {
  return scope === "premise" ? "premise" : `chapter_${scope}`;
}

function configColumns(config: BookConfig) {
  return {
    presetId: config.presetId,
    presetName: config.presetName,
    plannerModel: config.models.planner,
    executorModel: config.models.executor,
    summarizerModel: config.models.summarizer,
    imagePrompterModel: config.models.imagePrompter,
    rolesJson: config.roles,
    configCreatedAt: config.createdAt,
    configUpdatedAt: config.updatedAt,
  };
}

async function readBookConfig(file: string): Promise<BookConfig | null> {
  try {
    if (!(await pathExists(file))) return null;
    return await readJson(file, bookConfigSchema);
  } catch (error) {
    console.warn(`[db] Could not import legacy config ${file}:`, error);
    return null;
  }
}

async function importChats(db: AppDb, bookId: string, directory: string): Promise<void> {
  if (!(await pathExists(directory))) return;
  let files: string[] = [];
  try {
    files = (await fs.readdir(directory)).filter((name) => name.endsWith(".json"));
  } catch {
    return;
  }

  for (const name of files) {
    try {
      const chat = await readJson(path.join(directory, name), chatSchema);
      db.insert(schema.chats)
        .values({
          bookId,
          scope: scopeKey(chat.scope),
          messagesJson: chat.messages,
          updatedAt: chat.updatedAt,
        })
        .onConflictDoNothing()
        .run();
    } catch (error) {
      console.warn(`[db] Could not import legacy chat ${path.join(directory, name)}:`, error);
    }
  }
}

export async function migrateLegacyProvider(db: AppDb): Promise<void> {
  const existing = db.select({ id: schema.providers.id }).from(schema.providers).limit(1).get();
  if (existing) return;

  const settings = db
    .select()
    .from(schema.globalSettings)
    .where(eq(schema.globalSettings.id, 1))
    .get();
  if (!settings?.baseUrl) return;

  db.insert(schema.providers)
    .values({
      id: "legacy-default",
      name: "Default provider",
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      connectionOk: settings.connectionOk,
      connectionCheckedAt: settings.connectionCheckedAt ?? null,
      connectionLatencyMs: settings.connectionLatencyMs ?? null,
      connectionDetail: settings.connectionDetail ?? null,
      createdAt: settings.updatedAt,
      updatedAt: settings.updatedAt,
    })
    .onConflictDoNothing()
    .run();
}

export async function migrateLegacyFiles(db: AppDb): Promise<void> {
  const marker = db
    .select({ key: schema.meta.key })
    .from(schema.meta)
    .where(eq(schema.meta.key, MIGRATION_KEY))
    .get();
  if (marker) return;

  // Global settings and presets.
  try {
    if (await pathExists(CONFIG_PATH)) {
      const raw = await readJson(CONFIG_PATH, appConfigSchema);
      const config = normalizeConfig(raw);
      const existing = db
        .select({ id: schema.globalSettings.id })
        .from(schema.globalSettings)
        .where(eq(schema.globalSettings.id, 1))
        .get();

      if (!existing) {
        db.insert(schema.globalSettings)
          .values({
            id: 1,
            baseUrl: config.baseUrl,
            apiKey: config.apiKey,
            plannerModel: config.models.planner,
            executorModel: config.models.executor,
            summarizerModel: config.models.summarizer,
            imagePrompterModel: config.models.imagePrompter,
            connectionOk: config.connection.ok,
            connectionCheckedAt: config.connection.checkedAt ?? null,
            connectionLatencyMs: config.connection.latencyMs ?? null,
            connectionDetail: config.connection.detail ?? null,
            defaultPresetId: config.defaultPresetId,
            updatedAt: config.updatedAt,
          })
          .run();
      }

      for (const preset of config.presets) {
        db.insert(schema.presets)
          .values({
            id: preset.id,
            name: preset.name,
            description: preset.description,
            builtIn: preset.builtIn,
            rolesJson: preset.roles,
            createdAt: preset.createdAt,
            updatedAt: preset.updatedAt,
          })
          .onConflictDoNothing()
          .run();
      }
    }
  } catch (error) {
    console.warn("[db] Could not import legacy app_config.json:", error);
  }

  // Published books.
  const novelDirs = (await listDirectories(NOVELS_DIR)).filter((name) => !name.startsWith("."));
  for (const slug of novelDirs) {
    try {
      const file = outlinePath(slug);
      if (!(await pathExists(file))) continue;
      const outline = await readJson(file, outlineSchema);
      const existing = db
        .select({ id: schema.books.id })
        .from(schema.books)
        .where(eq(schema.books.slug, slug))
        .get();
      if (existing) continue;

      const bookId = randomUUID();
      const config = await readBookConfig(bookConfigPath(slug));
      db.insert(schema.books)
        .values({
          id: bookId,
          slug,
          title: outline.title,
          premise: outline.premise,
          status: outline.status,
          isDraft: false,
          currentChapter: outline.currentChapter,
          createdAt: outline.createdAt,
          updatedAt: outline.updatedAt,
          ...(config ? configColumns(config) : {}),
        })
        .onConflictDoNothing()
        .run();

      for (const [index, character] of outline.characters.entries()) {
        db.insert(schema.characters)
          .values({
            bookId,
            name: character.name,
            role: character.role,
            description: character.description,
            sortOrder: index,
          })
          .run();
      }

      for (const chapter of outline.chapters) {
        db.insert(schema.chapters)
          .values({
            bookId,
            number: chapter.number,
            title: chapter.title,
            summary: chapter.summary,
            status: chapter.status,
            wordCount: chapter.wordCount,
            summaryStale: chapter.summaryStale,
            updatedAt: chapter.updatedAt,
            summaryUpdatedAt: chapter.summaryUpdatedAt ?? null,
          })
          .onConflictDoNothing()
          .run();
      }

      await importChats(db, bookId, chatsDir(slug));
    } catch (error) {
      console.warn(`[db] Could not import legacy book ${slug}:`, error);
    }
  }

  // Brainstorm-first drafts.
  const draftDirs = await listDirectories(DRAFTS_DIR);
  for (const draftId of draftDirs) {
    try {
      const file = draftOutlinePath(draftId);
      if (!(await pathExists(file))) continue;
      const outline = await readJson(file, outlineSchema);
      const existing = db
        .select({ id: schema.books.id })
        .from(schema.books)
        .where(eq(schema.books.id, draftId))
        .get();
      if (existing) continue;

      const config = await readBookConfig(draftBookConfigPath(draftId));
      db.insert(schema.books)
        .values({
          id: draftId,
          slug: null,
          title: outline.title,
          premise: outline.premise,
          status: "brainstorming",
          isDraft: true,
          currentChapter: outline.currentChapter,
          createdAt: outline.createdAt,
          updatedAt: outline.updatedAt,
          ...(config ? configColumns(config) : {}),
        })
        .onConflictDoNothing()
        .run();

      for (const [index, character] of outline.characters.entries()) {
        db.insert(schema.characters)
          .values({
            bookId: draftId,
            name: character.name,
            role: character.role,
            description: character.description,
            sortOrder: index,
          })
          .run();
      }

      for (const chapter of outline.chapters) {
        db.insert(schema.chapters)
          .values({
            bookId: draftId,
            number: chapter.number,
            title: chapter.title,
            summary: chapter.summary,
            status: chapter.status,
            wordCount: chapter.wordCount,
            summaryStale: chapter.summaryStale,
            updatedAt: chapter.updatedAt,
            summaryUpdatedAt: chapter.summaryUpdatedAt ?? null,
          })
          .onConflictDoNothing()
          .run();
      }

      await importChats(db, draftId, path.join(draftDir(draftId), "chats"));
    } catch (error) {
      console.warn(`[db] Could not import legacy draft ${draftId}:`, error);
    }
  }

  db.insert(schema.meta)
    .values({ key: MIGRATION_KEY, value: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}
