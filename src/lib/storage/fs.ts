import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ZodType } from "zod";
import { StorageError } from "@/lib/errors";
import { DATA_DIR, DRAFTS_DIR, NOVELS_DIR, TRASH_DIR } from "@/lib/storage/paths";

let dirsPromise: Promise<void> | null = null;

export function ensureDataDirs(): Promise<void> {
  if (!dirsPromise) {
    dirsPromise = (async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.mkdir(NOVELS_DIR, { recursive: true });
      await fs.mkdir(DRAFTS_DIR, { recursive: true });
      await fs.mkdir(TRASH_DIR, { recursive: true });
    })().catch((error) => {
      dirsPromise = null;
      throw new StorageError("Could not create the data directory.", "STORAGE_IO", error);
    });
  }
  return dirsPromise;
}

const locks = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => current);
  locks.set(key, chained);
  try {
    await previous.catch(() => undefined);
    return await fn();
  } finally {
    release();
    if (locks.get(key) === chained) {
      locks.delete(key);
    }
  }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readText(target: string, fallback = ""): Promise<string> {
  try {
    return await fs.readFile(target, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return fallback;
    throw new StorageError(`Could not read ${path.basename(target)}.`, "STORAGE_IO", error);
  }
}

export async function readJson<T>(target: string, schema: ZodType<T>, fallback?: T): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(target, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      if (fallback !== undefined) return fallback;
      throw new StorageError(`Missing file: ${path.basename(target)}.`, "STORAGE_IO", error);
    }
    throw new StorageError(`Could not read ${path.basename(target)}.`, "STORAGE_IO", error);
  }

  const parsed = schema.safeParse(safeJsonParse(raw));
  if (parsed.success) return parsed.data;

  const backup = `${target}.bak`;
  if (await pathExists(backup)) {
    try {
      const backupRaw = await fs.readFile(backup, "utf8");
      const backupParsed = schema.safeParse(safeJsonParse(backupRaw));
      if (backupParsed.success) {
        console.warn(`[storage] Recovered ${path.basename(target)} from its backup.`);
        return backupParsed.data;
      }
    } catch {
      // fall through to the corrupt error
    }
  }

  throw new StorageError(
    `${path.basename(target)} is unreadable. Restore it from a backup or remove it.`,
    "STORAGE_CORRUPT",
    parsed.error,
  );
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJsonAtomic(target: string, value: unknown): Promise<void> {
  await writeFileAtomic(target, JSON.stringify(value, null, 2) + "\n", true);
}

export async function writeTextAtomic(target: string, value: string): Promise<void> {
  await writeFileAtomic(target, value, false);
}

async function writeFileAtomic(target: string, value: string, backup: boolean): Promise<void> {
  const dir = path.dirname(target);
  await fs.mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, value, "utf8");
    if (backup && (await pathExists(target))) {
      await fs.copyFile(target, `${target}.bak`).catch(() => undefined);
    }
    await fs.rename(temp, target);
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw new StorageError(`Could not save ${path.basename(target)}.`, "STORAGE_IO", error);
  }
}

export async function listDirectories(target: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(target, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw new StorageError("Could not list the library.", "STORAGE_IO", error);
  }
}

export async function moveDirectory(from: string, to: string): Promise<void> {
  await fs.mkdir(path.dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EXDEV") {
      await fs.cp(from, to, { recursive: true, errorOnExist: true });
      await fs.rm(from, { recursive: true, force: true });
      return;
    }
    throw new StorageError("Could not move the project folder.", "STORAGE_IO", error);
  }
}

export async function removeDirectory(target: string): Promise<void> {
  await fs.rm(target, { recursive: true, force: true });
}

export async function fileModifiedAt(target: string): Promise<Date | null> {
  try {
    const stat = await fs.stat(target);
    return stat.mtime;
  } catch {
    return null;
  }
}
