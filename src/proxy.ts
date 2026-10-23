import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth/token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
const CORS_METHODS = "GET,POST,PUT,DELETE,OPTIONS";
const CORS_HEADERS = "Content-Type, Accept";

function requestHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded?.split(",")[0]?.trim() || request.headers.get("host") || "";
  return host.toLowerCase();
}

function sameHostOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return null;
  try {
    return new URL(origin).host.toLowerCase() === requestHost(request) ? origin : null;
  } catch {
    return null;
  }
}

function withCors(response: NextResponse, origin: string | null): NextResponse {
  if (!origin) return response;
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Allow-Methods", CORS_METHODS);
  response.headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
  response.headers.append("Vary", "Origin");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const origin = sameHostOrigin(request);

  if (isApi && request.method === "OPTIONS") {
    if (!origin) {
      return new NextResponse(null, { status: 403 });
    }
    return withCors(new NextResponse(null, { status: 204 }), origin);
  }

  if (PUBLIC_PATHS.some((path) => pathname === path)) {
    return withCors(NextResponse.next(), origin);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) {
    return withCors(NextResponse.next(), origin);
  }

  if (isApi) {
    return withCors(
      NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to continue." } },
        { status: 401 },
      ),
      origin,
    );
  }

  const login = new URL("/login", request.url);
  if (pathname !== "/") {
    login.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
