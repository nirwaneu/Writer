import { NextResponse } from "next/server";
import { assertSameOrigin, errorResponse } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/session";
import { isSecureRequest } from "@/lib/auth/secure-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await clearSessionCookie(isSecureRequest(request));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
