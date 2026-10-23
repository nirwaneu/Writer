import { AppError } from "@/lib/errors";

const active = new Map<string, number>();

export function acquire(key: string): void {
  const current = active.get(key) ?? 0;
  if (current > 0) {
    throw new AppError(
      "CONFLICT",
      "A generation is already running for this chapter. Wait for it to finish or stop it first.",
      { status: 409, retryable: true },
    );
  }
  active.set(key, current + 1);
}

export function release(key: string): void {
  const current = active.get(key) ?? 0;
  if (current <= 1) active.delete(key);
  else active.set(key, current - 1);
}
