import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/lib/db/schema";
import { DB_PATH, DATA_DIR } from "@/lib/storage/paths";
import { migrateLegacyFiles, migrateLegacyProvider } from "@/lib/db/migrate";

export type AppDb = BetterSQLite3Database<typeof schema>;

const CHAPTER_COLUMNS: Array<[string, string]> = [
  ["kind", "TEXT NOT NULL DEFAULT 'chapter'"],
  ["chapter_number", "INTEGER"],
  ["image_path", "TEXT"],
  ["image_prompt", "TEXT"],
  ["image_negative_prompt", "TEXT"],
  ["image_aspect_ratio", "TEXT"],
  ["image_provider_id", "TEXT"],
  ["image_model", "TEXT"],
  ["image_updated_at", "TEXT"],
];

function migrateChapterColumns(database: Database.Database): void {
  const existing = new Set(
    (database.prepare("PRAGMA table_info(chapters)").all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  for (const [name, definition] of CHAPTER_COLUMNS) {
    if (!existing.has(name)) {
      database.exec(`ALTER TABLE chapters ADD COLUMN ${name} ${definition}`);
    }
  }
}

const DDL = `
CREATE TABLE IF NOT EXISTS global_settings (
  id INTEGER PRIMARY KEY,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  planner_model TEXT NOT NULL DEFAULT '',
  executor_model TEXT NOT NULL DEFAULT '',
  summarizer_model TEXT NOT NULL DEFAULT '',
  connection_ok INTEGER NOT NULL DEFAULT 0,
  connection_checked_at TEXT,
  connection_latency_ms INTEGER,
  connection_detail TEXT,
  default_preset_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT NOT NULL DEFAULT '',
  connection_ok INTEGER NOT NULL DEFAULT 0,
  connection_checked_at TEXT,
  connection_latency_ms INTEGER,
  connection_detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS providers_created_idx ON providers (created_at);

CREATE TABLE IF NOT EXISTS presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  built_in INTEGER NOT NULL DEFAULT 0,
  roles_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  premise TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  is_draft INTEGER NOT NULL DEFAULT 0,
  current_chapter INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  preset_id TEXT,
  preset_name TEXT,
  planner_model TEXT,
  executor_model TEXT,
  summarizer_model TEXT,
  roles_json TEXT,
  config_created_at TEXT,
  config_updated_at TEXT
);
CREATE INDEX IF NOT EXISTS books_slug_idx ON books (slug);
CREATE INDEX IF NOT EXISTS books_draft_idx ON books (is_draft);

CREATE TABLE IF NOT EXISTS chapters (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  word_count INTEGER NOT NULL DEFAULT 0,
  summary_stale INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  summary_updated_at TEXT,
  kind TEXT NOT NULL DEFAULT 'chapter',
  chapter_number INTEGER,
  image_path TEXT,
  image_prompt TEXT,
  image_negative_prompt TEXT,
  image_aspect_ratio TEXT,
  image_provider_id TEXT,
  image_model TEXT,
  image_updated_at TEXT,
  PRIMARY KEY (book_id, number)
);
CREATE INDEX IF NOT EXISTS chapters_book_idx ON chapters (book_id);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS characters_book_idx ON characters (book_id);

CREATE TABLE IF NOT EXISTS chats (
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (book_id, scope)
);
CREATE INDEX IF NOT EXISTS chats_book_idx ON chats (book_id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

let dbPromise: Promise<AppDb> | null = null;
let sqlite: Database.Database | null = null;

async function initialize(): Promise<AppDb> {
  mkdirSync(DATA_DIR, { recursive: true });
  const database = new Database(DB_PATH);
  sqlite = database;
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("busy_timeout = 5000");
  database.exec(DDL);
  migrateChapterColumns(database);

  const db = drizzle(database, { schema });
  await migrateLegacyFiles(db);
  await migrateLegacyProvider(db);
  return db;
}

export function getDb(): Promise<AppDb> {
  if (!dbPromise) {
    dbPromise = initialize().catch((error) => {
      dbPromise = null;
      if (sqlite) {
        try {
          sqlite.close();
        } catch {
          // already closed
        }
        sqlite = null;
      }
      throw error;
    });
  }
  return dbPromise;
}

export function closeDb(): void {
  if (sqlite) {
    try {
      sqlite.close();
    } catch {
      // already closed
    }
    sqlite = null;
  }
  dbPromise = null;
}
