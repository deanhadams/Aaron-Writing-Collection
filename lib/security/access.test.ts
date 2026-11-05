import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const PUBLIC_ROUTES = new Set(["/login", "/api/health", "/robots.txt"]);
const SAMPLE_ID = "00000000-0000-0000-0000-000000000000";

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every page and API route in the app, read from the folders, so a new one can't be missed. */
const routes = walk("app")
  .filter((file) => /[\\/](page\.tsx|route\.ts)$/.test(file) || file.endsWith(`${sep}robots.ts`))
  .map((file) => {
    if (file.endsWith("robots.ts")) return "/robots.txt";
    const folder = relative("app", file).split(sep).slice(0, -1).join("/");
    return `/${folder}`.replace(/\[[^\]]+\]/g, SAMPLE_ID);
  });

const matcher = new RegExp(`^${config.matcher[0]}$`);
const anonymous = (path: string) => proxy(new NextRequest(new URL(path, "http://localhost:3000")));

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters";
});

describe("every route", () => {
  it("found the app's routes", () => {
    expect(routes.length).toBeGreaterThan(30);
    for (const path of ["/", "/login", "/search", "/api/backup", "/api/search", "/api/health"]) expect(routes).toContain(path);
  });

  const closed = () => routes.filter((path) => !PUBLIC_ROUTES.has(path));

  it("needs a session, except the public few", async () => {
    for (const path of closed()) {
      const response = await anonymous(path);
      if (path.startsWith("/api")) expect(response.status, path).toBe(401);
      else {
        expect(response.status, path).toBe(307);
        expect(new URL(response.headers.get("location")!).pathname, path).toBe("/login");
      }
    }
  });

  it("goes through the proxy, so none can skip that check", () => {
    for (const path of closed()) expect(matcher.test(path), path).toBe(true);
  });

  it("opens only what is meant to be public", async () => {
    expect((await anonymous("/login")).status).toBe(200);
    expect((await anonymous("/api/health")).status).toBe(200);
    expect(matcher.test("/robots.txt")).toBe(false);
  });

  it("does not open lookalikes of the public paths", async () => {
    for (const path of ["/api/health/extra", "/api/healthz", "/login/extra", "/robots.txt/extra"]) {
      expect((await anonymous(path)).status, path).not.toBe(200);
    }
  });

  it("refuses a forged session", async () => {
    const request = new NextRequest(new URL("/api/backup", "http://localhost:3000"), {
      headers: { cookie: "session=not.a.token" },
    });
    expect((await proxy(request)).status).toBe(401);
  });
});

describe("the proxy's headers", () => {
  it("adds the content security policy to pages, redirects and refusals", async () => {
    for (const path of ["/login", "/", "/api/backup"]) {
      expect((await anonymous(path)).headers.get("content-security-policy"), path).toContain("frame-ancestors 'none'");
    }
  });
});
