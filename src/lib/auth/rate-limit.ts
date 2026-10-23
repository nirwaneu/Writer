type Entry = { count: number; resetAt: number; blockedUntil: number };

const entries = new Map<string, Entry>();
const LIMIT = 5;
const WINDOW_MS = 5 * 60_000;
const BLOCK_MS = 5 * 60_000;

function now() {
  return Date.now();
}

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const entry = entries.get(key);
  const current = now();
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.blockedUntil > current) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - current) / 1000) };
  }
  if (entry.resetAt < current) {
    entries.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailure(key: string): { remaining: number } {
  const current = now();
  const entry = entries.get(key);
  if (!entry || entry.resetAt < current) {
    entries.set(key, { count: 1, resetAt: current + WINDOW_MS, blockedUntil: 0 });
    return { remaining: LIMIT - 1 };
  }
  entry.count += 1;
  if (entry.count >= LIMIT) {
    entry.blockedUntil = current + BLOCK_MS;
  }
  return { remaining: Math.max(0, LIMIT - entry.count) };
}

export function clearRateLimit(key: string): void {
  entries.delete(key);
}

setInterval(() => {
  const current = now();
  for (const [key, entry] of entries) {
    if (entry.blockedUntil < current && entry.resetAt < current) entries.delete(key);
  }
}, 60_000).unref?.();
