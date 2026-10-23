import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  ChapterStatus,
  ChatMessage,
  Outline,
  PresetRoles,
} from "@/lib/schemas";

export const globalSettings = sqliteTable("global_settings", {
  id: integer("id").primaryKey(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key").notNull().default(""),
  plannerModel: text("planner_model").notNull().default(""),
  executorModel: text("executor_model").notNull().default(""),
  summarizerModel: text("summarizer_model").notNull().default(""),
  connectionOk: integer("connection_ok", { mode: "boolean" }).notNull().default(false),
  connectionCheckedAt: text("connection_checked_at"),
  connectionLatencyMs: integer("connection_latency_ms"),
  connectionDetail: text("connection_detail"),
  defaultPresetId: text("default_preset_id").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const providers = sqliteTable(
  "providers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    baseUrl: text("base_url").notNull(),
    apiKey: text("api_key").notNull().default(""),
    connectionOk: integer("connection_ok", { mode: "boolean" }).notNull().default(false),
    connectionCheckedAt: text("connection_checked_at"),
    connectionLatencyMs: integer("connection_latency_ms"),
    connectionDetail: text("connection_detail"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("providers_created_idx").on(table.createdAt)],
);

export const presets = sqliteTable("presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false),
  rolesJson: text("roles_json", { mode: "json" }).$type<PresetRoles>().notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const books = sqliteTable(
  "books",
  {
    id: text("id").primaryKey(),
    slug: text("slug").unique(),
    title: text("title").notNull(),
    premise: text("premise").notNull().default(""),
    status: text("status").$type<Outline["status"]>().notNull().default("active"),
    isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
    currentChapter: integer("current_chapter").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    presetId: text("preset_id"),
    presetName: text("preset_name"),
    plannerModel: text("planner_model"),
    executorModel: text("executor_model"),
    summarizerModel: text("summarizer_model"),
    rolesJson: text("roles_json", { mode: "json" }).$type<PresetRoles>(),
    configCreatedAt: text("config_created_at"),
    configUpdatedAt: text("config_updated_at"),
  },
  (table) => [index("books_slug_idx").on(table.slug), index("books_draft_idx").on(table.isDraft)],
);

export const chapters = sqliteTable(
  "chapters",
  {
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    status: text("status").$type<ChapterStatus>().notNull().default("planned"),
    wordCount: integer("word_count").notNull().default(0),
    summaryStale: integer("summary_stale", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull(),
    summaryUpdatedAt: text("summary_updated_at"),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.number] }),
    index("chapters_book_idx").on(table.bookId),
  ],
);

export const characters = sqliteTable(
  "characters",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: text("role").notNull().default(""),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("characters_book_idx").on(table.bookId)],
);

export const chats = sqliteTable(
  "chats",
  {
    bookId: text("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    messagesJson: text("messages_json", { mode: "json" }).$type<ChatMessage[]>().notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bookId, table.scope] }),
    index("chats_book_idx").on(table.bookId),
  ],
);

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type DbProvider = typeof providers.$inferSelect;
export type DbBook = typeof books.$inferSelect;
export type DbPreset = typeof presets.$inferSelect;
export type DbChapter = typeof chapters.$inferSelect;
export type DbCharacter = typeof characters.$inferSelect;
export type DbChat = typeof chats.$inferSelect;
