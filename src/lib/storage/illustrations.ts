import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  illustrationsDir,
  illustrationPath,
} from "@/lib/storage/paths";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function extensionForMime(mime: string): string {
  return EXTENSIONS[mime] ?? "png";
}

export async function writeIllustrationFile(
  slug: string,
  pageNumber: number,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  const directory = illustrationsDir(slug);
  await fs.mkdir(directory, { recursive: true });
  const filename = `illustration-${pageNumber}-${randomUUID()}.${extensionForMime(mime)}`;
  const target = illustrationPath(slug, filename);
  const temp = path.join(directory, `.${filename}.tmp`);
  try {
    await fs.writeFile(temp, bytes);
    await fs.rename(temp, target);
    return filename;
  } catch (error) {
    await fs.rm(temp, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteIllustrationFile(
  slug: string,
  filename: string,
): Promise<void> {
  await fs.rm(illustrationPath(slug, filename), { force: true });
}
