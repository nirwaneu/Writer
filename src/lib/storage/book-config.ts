import { and, eq } from "drizzle-orm";
import {
  bookConfigSchema,
  type BookConfig,
  type BookConfigUpdateInput,
} from "@/lib/schemas";
import { AppError, NotFoundError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { getConfig } from "@/lib/storage/config";
import { buildFallbackBookConfig } from "@/lib/presets/defaults";

export type BookConfigSource = "local" | "fallback";

export type ResolvedBookConfig = {
  config: BookConfig;
  source: BookConfigSource;
};

type BookRow = typeof books.$inferSelect;

function hasLocalConfig(row: BookRow): boolean {
  return Boolean(
    row.presetId &&
      row.presetName &&
      row.plannerModel &&
      row.executorModel &&
      row.summarizerModel &&
      row.rolesJson,
  );
}

function rowToBookConfig(row: BookRow): BookConfig {
  return bookConfigSchema.parse({
    version: 1,
    presetId: row.presetId,
    presetName: row.presetName,
    models: {
      planner: row.plannerModel,
      executor: row.executorModel,
      summarizer: row.summarizerModel,
      imagePrompter: row.imagePrompterModel ?? "",
    },
    roles: row.rolesJson,
    createdAt: row.configCreatedAt ?? row.createdAt,
    updatedAt: row.configUpdatedAt ?? row.updatedAt,
  });
}

async function fallbackConfig(): Promise<BookConfig> {
  const global = await getConfig();
  if (!global) {
    throw new AppError(
      "CONFIG_REQUIRED",
      "Connect a model provider before opening book settings.",
      { status: 428 },
    );
  }
  return buildFallbackBookConfig(global);
}

export async function getBookConfig(slug: string): Promise<ResolvedBookConfig> {
  const db = await getDb();
  const row = db
    .select()
    .from(books)
    .where(and(eq(books.slug, slug), eq(books.isDraft, false)))
    .get();
  if (!row) throw new NotFoundError("That book does not exist.");

  if (hasLocalConfig(row)) {
    try {
      return { config: rowToBookConfig(row), source: "local" };
    } catch (error) {
      console.warn(`[book-config] Ignoring unreadable local settings for ${slug}.`, error);
    }
  }

  return { config: await fallbackConfig(), source: "fallback" };
}

export async function getDraftBookConfig(id: string): Promise<ResolvedBookConfig> {
  const db = await getDb();
  const row = db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.isDraft, true)))
    .get();
  if (!row) throw new NotFoundError("That draft does not exist.");

  if (hasLocalConfig(row)) {
    try {
      return { config: rowToBookConfig(row), source: "local" };
    } catch (error) {
      console.warn(`[book-config] Ignoring unreadable local settings for draft ${id}.`, error);
    }
  }

  return { config: await fallbackConfig(), source: "fallback" };
}

export async function saveBookConfig(
  slug: string,
  input: BookConfigUpdateInput,
): Promise<BookConfig> {
  const db = await getDb();
  const row = db
    .select()
    .from(books)
    .where(and(eq(books.slug, slug), eq(books.isDraft, false)))
    .get();
  if (!row) throw new NotFoundError("That book does not exist.");

  const current = rowToBookConfigSafe(row) ?? (await fallbackConfig());
  const timestamp = new Date().toISOString();
  const config = bookConfigSchema.parse({
    version: 1,
    presetId: input.presetId ?? current.presetId,
    presetName: input.presetName ?? current.presetName,
    models: input.models,
    roles: input.roles,
    createdAt: current.createdAt,
    updatedAt: timestamp,
  });

  db.update(books)
    .set({
      presetId: config.presetId,
      presetName: config.presetName,
      plannerModel: config.models.planner,
      executorModel: config.models.executor,
      summarizerModel: config.models.summarizer,
      imagePrompterModel: config.models.imagePrompter,
      rolesJson: config.roles,
      configCreatedAt: config.createdAt,
      configUpdatedAt: timestamp,
    })
    .where(eq(books.id, row.id))
    .run();

  return config;
}

function rowToBookConfigSafe(row: BookRow): BookConfig | null {
  if (!hasLocalConfig(row)) return null;
  try {
    return rowToBookConfig(row);
  } catch {
    return null;
  }
}
