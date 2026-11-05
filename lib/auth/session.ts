import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "session";

const SESSION_DAYS = 30;
const MIN_SECRET_LENGTH = 32;

export type Session = {
  userId: string;
  name: string;
};

// Throws rather than falling back, so a missing or placeholder secret
// fails closed instead of signing cookies with something guessable.
function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return new TextEncoder().encode(secret);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
} as const;

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ name: session.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    // A new id each login, so no two sessions share a token.
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getKey());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<Session | null> {
  const key = getKey();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.name !== "string") return null;
    return { userId: payload.sub, name: payload.name };
  } catch {
    return null;
  }
}
