import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMissingUsers } from "@/lib/auth/create-users";
import { attemptKeys, clearFailures, clientIp, MAX_FAILURES, minutesBlocked, recordFailure, WINDOW_MS } from "@/lib/auth/rate-limit";
import { createSessionToken, sessionCookieOptions, verifySessionToken } from "@/lib/auth/session";
import { loginAttempts, users } from "@/lib/db/schema";
import { assertEnv, envProblems, OPTIONAL_ENV, productionDbLabel, REQUIRED_ENV } from "@/lib/env";
import { isReachable } from "@/lib/health";
import { createTestDb } from "@/lib/scenes/test-db";
import { contentSecurityPolicy, STATIC_HEADERS } from "./headers";

const good = {
  DATABASE_URL: "postgresql://user:hunter2-secret@ep-real-pooler.neon.tech/db",
  SESSION_SECRET: "a-real-secret-that-is-long-enough-to-use",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "bucket",
  R2_PUBLIC_URL: "https://pub-abc.r2.dev",
};

describe("environment", () => {
  it("accepts a complete environment", () => {
    expect(envProblems(good)).toEqual([]);
  });

  it("names everything missing", () => {
    const problems = envProblems({});
    for (const name of REQUIRED_ENV) expect(problems.join()).toContain(name);
  });

  it("wants a long session secret and real addresses", () => {
    expect(envProblems({ ...good, SESSION_SECRET: "short" })).toEqual(["SESSION_SECRET must be at least 32 characters"]);
    expect(envProblems({ ...good, DATABASE_URL: "mysql://x" }).join()).toContain("postgresql://");
    expect(envProblems({ ...good, R2_PUBLIC_URL: "nope" }).join()).toContain("R2_PUBLIC_URL");
  });

  it("does not need SEED_USERS to run", () => {
    expect(envProblems(good)).toEqual([]);
    expect(OPTIONAL_ENV).toContain("SEED_USERS");
  });

  it("never prints a value", () => {
    const problems = envProblems({ ...good, SESSION_SECRET: "hunter2", DATABASE_URL: "hunter2://x" }).join();
    expect(problems).not.toContain("hunter2");
  });

  it("refuses to start on a placeholder, which would be a public secret", () => {
    const sample = { ...good, SESSION_SECRET: "replace-with-at-least-32-random-characters" };
    expect(envProblems(sample)).toEqual(["SESSION_SECRET still has its placeholder value"]);
    expect(envProblems(sample, { sample: true })).toEqual([]);
  });

  it("stops a start with a clear message", () => {
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    assertEnv({});

    expect(exit).toHaveBeenCalledWith(1);
    expect(error.mock.calls[0][0]).toContain("DATABASE_URL");
    vi.restoreAllMocks();
  });
});

describe(".env.example", () => {
  const file = readFileSync(".env.example", "utf8");
  const values = parse(file);

  it("lists every variable", () => {
    for (const name of [...REQUIRED_ENV, ...OPTIONAL_ENV]) expect(values).toHaveProperty(name);
  });

  it("passes the schema's shape, and would be refused as a real environment", () => {
    expect(envProblems(values, { sample: true })).toEqual([]);
    expect(envProblems(values).length).toBe(REQUIRED_ENV.length);
  });

  it("holds no real address or password", () => {
    expect(file).toContain("person@example.com");
    expect(file).not.toMatch(/gmail\.com/);
    expect(values.SEED_USERS).toContain('"password":"change-me"');
  });
});

describe("the production database banner", () => {
  const dev = { NODE_ENV: "development", DATABASE_URL: good.DATABASE_URL, PRODUCTION_DB_HOST_HINT: "ep-real" };

  it("shows a label in development against the production host", () => {
    expect(productionDbLabel(dev)).toBe("Production database");
    expect(productionDbLabel({ ...dev, APP_ENV_LABEL: "LIVE" })).toBe("LIVE");
  });

  it("stays quiet elsewhere", () => {
    expect(productionDbLabel({ ...dev, NODE_ENV: "production" })).toBeNull();
    expect(productionDbLabel({ ...dev, PRODUCTION_DB_HOST_HINT: "ep-other" })).toBeNull();
    expect(productionDbLabel({ ...dev, PRODUCTION_DB_HOST_HINT: "" })).toBeNull();
  });

  it("matches the host only, not the password", () => {
    expect(productionDbLabel({ ...dev, PRODUCTION_DB_HOST_HINT: "hunter2" })).toBeNull();
  });

  it("never holds any part of the address", () => {
    expect(productionDbLabel(dev)).not.toContain("neon");
  });
});

describe("content security policy", () => {
  const env = { NODE_ENV: "production", R2_PUBLIC_URL: "https://pub-abc.r2.dev/", R2_ACCOUNT_ID: "acct" };
  const directive = (name: string, source = env) =>
    contentSecurityPolicy(source).split("; ").find((part) => part.startsWith(`${name} `));

  it("allows images from the bucket and uploads to R2", () => {
    expect(directive("img-src")).toContain("https://pub-abc.r2.dev");
    expect(directive("connect-src")).toContain("https://acct.r2.cloudflarestorage.com");
  });

  it("keeps fonts local and framing off", () => {
    expect(directive("font-src")).toBe("font-src 'self'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
  });

  it("allows eval only in development", () => {
    expect(directive("script-src")).not.toContain("unsafe-eval");
    expect(directive("script-src", { ...env, NODE_ENV: "development" })).toContain("unsafe-eval");
  });

  it("holds no secret", () => {
    expect(contentSecurityPolicy({ ...env, R2_SECRET_ACCESS_KEY: "hunter2", DATABASE_URL: "hunter2" })).not.toContain("hunter2");
  });

  it("sets the other headers", () => {
    const names = STATIC_HEADERS.map(({ key }) => key);
    expect(names).toEqual(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "X-Robots-Tag"]);
  });
});

describe("health check", () => {
  it("is healthy when the ping answers", async () => {
    expect(await isReachable(async () => 1)).toBe(true);
  });

  it("is unhealthy when the ping fails", async () => {
    expect(await isReachable(() => Promise.reject(new Error("down")))).toBe(false);
  });

  it("gives up on a ping that hangs", async () => {
    expect(await isReachable(() => new Promise(() => {}), 20)).toBe(false);
  });
});

describe("session cookie", () => {
  it("is out of reach of scripts and other sites", () => {
    expect(sessionCookieOptions).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(sessionCookieOptions.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("is a new token on every login", async () => {
    const session = { userId: "user", name: "Dean" };
    const [first, second] = await Promise.all([createSessionToken(session), createSessionToken(session)]);

    expect(first).not.toBe(second);
    expect(await verifySessionToken(second)).toMatchObject(session);
  });
});

describe("login rate limiting", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  const keys = attemptKeys({ email: "dean@example.com", ip: "1.2.3.4" });
  const now = new Date("2026-11-05T12:00:00Z");
  const fail = async (key: string[], times: number, at = now) => {
    for (let count = 0; count < times; count++) await recordFailure(db, key, at);
  };

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("allows up to the limit", async () => {
    await fail(keys, MAX_FAILURES - 1);
    expect(await minutesBlocked(db, keys, now)).toBeNull();
  });

  it("blocks at the limit and says for how long", async () => {
    await fail(keys, MAX_FAILURES);
    expect(await minutesBlocked(db, keys, now)).toBe(15);
    expect(await minutesBlocked(db, keys, new Date(now.getTime() + 10 * 60_000))).toBe(5);
  });

  it("limits an address trying many emails", async () => {
    for (let index = 0; index < MAX_FAILURES; index++) {
      await recordFailure(db, attemptKeys({ email: `person${index}@example.com`, ip: "1.2.3.4" }), now);
    }
    expect(await minutesBlocked(db, attemptKeys({ email: "other@example.com", ip: "1.2.3.4" }), now)).not.toBeNull();
    expect(await minutesBlocked(db, attemptKeys({ email: "other@example.com", ip: "5.6.7.8" }), now)).toBeNull();
  });

  it("limits one email tried from many addresses", async () => {
    for (let index = 0; index < MAX_FAILURES; index++) {
      await recordFailure(db, attemptKeys({ email: "dean@example.com", ip: `1.1.1.${index}` }), now);
    }
    expect(await minutesBlocked(db, attemptKeys({ email: "dean@example.com", ip: "9.9.9.9" }), now)).not.toBeNull();
  });

  it("lets go after the window", async () => {
    await fail(keys, MAX_FAILURES);
    expect(await minutesBlocked(db, keys, new Date(now.getTime() + WINDOW_MS + 1000))).toBeNull();
  });

  it("clears a person's count on a good password", async () => {
    await fail(keys, MAX_FAILURES - 1);
    await clearFailures(db, keys[0]);
    expect((await db.select().from(loginAttempts)).map(({ key }) => key)).not.toContain(keys[0]);
  });

  it("stores hashes, not emails or addresses, and tidies old rows", async () => {
    await fail(keys, 1, new Date(now.getTime() - 2 * WINDOW_MS));
    await fail(keys, 1);

    const rows = await db.select().from(loginAttempts);
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain("dean");
    expect(JSON.stringify(rows)).not.toContain("1.2.3.4");
  });

  it("reads the address Railway's edge sets, not one a client can forge", () => {
    expect(clientIp(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "6.6.6.6" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("db:seed:users", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  const person = { email: "kim@example.com", name: "Kim", password: "first-password" };

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("creates someone new", async () => {
    expect(await createMissingUsers(db, [person], 4)).toEqual({ created: ["kim@example.com"], skipped: [] });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("never changes an existing password or name", async () => {
    await createMissingUsers(db, [person], 4);
    const [before] = await db.select().from(users);

    const result = await createMissingUsers(db, [{ ...person, name: "Changed", password: "second-password" }], 4);

    expect(result).toEqual({ created: [], skipped: ["kim@example.com"] });
    expect((await db.select().from(users))[0]).toEqual(before);
  });

  it("adds only those missing", async () => {
    await createMissingUsers(db, [person], 4);
    const aaron = { email: "aaron@example.com", name: "Aaron", password: "another" };

    expect((await createMissingUsers(db, [person, aaron], 4)).created).toEqual(["aaron@example.com"]);
  });
});
