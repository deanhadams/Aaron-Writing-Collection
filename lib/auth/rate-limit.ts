import { createHash } from "node:crypto";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { loginAttempts } from "@/lib/db/schema";
import type { Database } from "@/lib/scenes/save-scene";

export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/** Hashed, so the table never holds who tried to log in or from where. */
const hashed = (value: string) => createHash("sha256").update(value).digest("hex");

export const attemptKeys = ({ email, ip }: { email: string; ip: string }) => [hashed(`email:${email}`), hashed(`ip:${ip}`)];

/**
 * Railway's edge sets X-Real-IP to the connecting address. X-Forwarded-For can
 * start with anything the client sent, so it is only the fallback.
 */
export function clientIp(headers: { get(name: string): string | null }) {
  return headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
}

/** Whole minutes until a blocked key can try again, or null if it isn't blocked. */
export async function minutesBlocked(db: Database, keys: string[], now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_MS);
  const rows = await db
    .select({
      key: loginAttempts.key,
      failures: sql<number>`count(*)::int`,
      newest: sql<Date>`max(${loginAttempts.attemptedAt})`,
    })
    .from(loginAttempts)
    .where(and(inArray(loginAttempts.key, keys), gte(loginAttempts.attemptedAt, since)))
    .groupBy(loginAttempts.key);

  const blocked = rows.filter(({ failures }) => failures >= MAX_FAILURES);
  if (blocked.length === 0) return null;

  const until = Math.max(...blocked.map(({ newest }) => new Date(newest).getTime() + WINDOW_MS));
  return Math.max(1, Math.ceil((until - now.getTime()) / 60_000));
}

export async function recordFailure(db: Database, keys: string[], now = new Date()) {
  await db.insert(loginAttempts).values(keys.map((key) => ({ key, attemptedAt: now })));
  await db.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, new Date(now.getTime() - WINDOW_MS)));
}

/** A correct password clears that person's count, but not the address's. */
export async function clearFailures(db: Database, emailKey: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, emailKey));
}
