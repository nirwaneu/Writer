import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "writer_session";
const SESSION_DAYS = 30;
const ISSUER = "cwriter";

export type Session = { username: string };

export function sessionSecret(): Uint8Array {
  const explicit = process.env.SESSION_SECRET?.trim();
  if (explicit && explicit.length >= 24) {
    return new TextEncoder().encode(explicit);
  }
  const username = process.env.APP_USERNAME?.trim() ?? "";
  const password = process.env.APP_PASSWORD ?? "";
  if (!username || !password) {
    throw new Error("APP_USERNAME and APP_PASSWORD must be set before sessions can be signed.");
  }
  return new TextEncoder().encode(`cwriter:${username}:${password}:session:v1`);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { issuer: ISSUER });
    const username = typeof payload.username === "string" ? payload.username : payload.sub;
    if (!username) return null;
    return { username };
  } catch {
    return null;
  }
}
