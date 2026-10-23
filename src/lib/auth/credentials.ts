import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";

export function getAuthEnv(): { username: string; password: string; configured: boolean } {
  const username = process.env.APP_USERNAME?.trim() ?? "";
  const password = process.env.APP_PASSWORD ?? "";
  return { username, password, configured: Boolean(username && password) };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

export function verifyCredentials(username: string, password: string): boolean {
  const env = getAuthEnv();
  if (!env.configured) {
    throw new AppError(
      "CONFIG_REQUIRED",
      "This server has no login configured. Set APP_USERNAME and APP_PASSWORD in .env and restart.",
      { status: 503 },
    );
  }
  const usernameOk = safeEqual(username, env.username);
  const passwordOk = safeEqual(password, env.password);
  return usernameOk && passwordOk;
}
