import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, clientKey, errorResponse, parseBody } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { verifyCredentials } from "@/lib/auth/credentials";
import { setSessionCookie } from "@/lib/auth/session";
import { isSecureRequest } from "@/lib/auth/secure-request";
import {
  checkRateLimit,
  clearRateLimit,
  recordFailure,
} from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const key = clientKey(request);
    const limit = checkRateLimit(key);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }

    const { username, password } = await parseBody(request, loginSchema);
    const valid = verifyCredentials(username, password);

    if (!valid) {
      const { remaining } = recordFailure(key);
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message:
              remaining > 0
                ? `Incorrect username or password. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
                : "Incorrect username or password. Sign-in is locked for five minutes.",
          },
        },
        { status: 401 },
      );
    }

    clearRateLimit(key);
    try {
      await setSessionCookie(username, isSecureRequest(request));
    } catch (error) {
      console.error("[auth] Credentials verified but the session could not be created:", error);
      throw new AppError(
        "SESSION_UNAVAILABLE",
        "Your credentials were accepted, but the session could not be created. Check APP_USERNAME, APP_PASSWORD, and SESSION_SECRET in .env, then restart the app.",
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, username });
  } catch (error) {
    return errorResponse(error);
  }
}
