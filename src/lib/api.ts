import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { AppError } from "@/lib/errors";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  console.error("[api] Unhandled error:", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: "Something went wrong on the server. Your files are untouched.",
      },
    },
    { status: 500 },
  );
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Expected a JSON request body.", { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("BAD_REQUEST", "Some fields are invalid.", {
      status: 400,
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Invalid request origin.", { status: 403 });
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  if (host && originHost.toLowerCase() !== host.toLowerCase()) {
    throw new AppError("FORBIDDEN", "Cross-origin requests are not allowed.", { status: 403 });
  }
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "local";
}
