import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { config, proxy } from "./proxy";

async function request(path: string, cookie?: string) {
  const headers = cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : undefined;
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
}

const validToken = () => createSessionToken({ userId: "1", name: "Aaron" });

const isAllowed = (response: Response) =>
  response.headers.get("x-middleware-next") === "1";

describe("proxy", () => {
  it("redirects anonymous page requests to login", async () => {
    const response = await request("/seasons/1");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fseasons%2F1",
    );
  });

  it("answers anonymous API requests with 401 JSON, not a redirect", async () => {
    const response = await request("/api/scenes");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("treats a forged cookie as anonymous", async () => {
    expect((await request("/api/scenes", "forged.cookie.value")).status).toBe(401);
  });

  it("lets a valid session through to pages and API routes", async () => {
    const token = await validToken();
    expect(isAllowed(await request("/seasons/1", token))).toBe(true);
    expect(isAllowed(await request("/api/scenes", token))).toBe(true);
  });

  it("allows the login page without a session", async () => {
    expect(isAllowed(await request("/login"))).toBe(true);
  });
});

describe("proxy matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/login", "/api/scenes", "/seasons/1", "/secret.png"])(
    "covers %s",
    (path) => expect(matcher.test(path)).toBe(true),
  );

  it.each(["/_next/static/chunks/a.js", "/_next/image", "/favicon.ico"])(
    "skips %s",
    (path) => expect(matcher.test(path)).toBe(false),
  );

  it("does not skip paths that only look like build assets", () => {
    expect(matcher.test("/_next/staticfoo")).toBe(true);
    expect(matcher.test("/favicon.ico.bak")).toBe(true);
  });
});
