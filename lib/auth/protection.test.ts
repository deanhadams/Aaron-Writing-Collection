import { describe, expect, it } from "vitest";
import { decideAccess, safeNextPath } from "./protection";

const anonymous = (pathname: string, search = "") =>
  decideAccess({ pathname, search, isAuthenticated: false });
const signedIn = (pathname: string) =>
  decideAccess({ pathname, search: "", isAuthenticated: true });

describe("decideAccess", () => {
  it("lets anyone reach the login page", () => {
    expect(anonymous("/login")).toEqual({ action: "allow" });
  });

  it("sends signed-in users away from the login page", () => {
    expect(signedIn("/login")).toEqual({ action: "redirect", to: "/" });
  });

  it("redirects anonymous page requests to login, keeping the destination", () => {
    expect(anonymous("/")).toEqual({ action: "redirect", to: "/login" });
    expect(anonymous("/seasons/1", "?tab=a")).toEqual({
      action: "redirect",
      to: "/login?next=%2Fseasons%2F1%3Ftab%3Da",
    });
  });

  it("returns unauthorized for anonymous API requests", () => {
    expect(anonymous("/api")).toEqual({ action: "unauthorized" });
    expect(anonymous("/api/scenes/1")).toEqual({ action: "unauthorized" });
  });

  it("lets anyone reach the health check, and nothing beside it", () => {
    expect(anonymous("/api/health")).toEqual({ action: "allow" });
    expect(anonymous("/api/health/extra")).toEqual({ action: "unauthorized" });
    expect(anonymous("/api/healthz")).toEqual({ action: "unauthorized" });
  });

  it("does not treat lookalike paths as public or as API", () => {
    expect(anonymous("/login/extra").action).toBe("redirect");
    expect(anonymous("/loginx").action).toBe("redirect");
    expect(anonymous("/apiary").action).toBe("redirect");
  });

  it("allows signed-in users everywhere else", () => {
    expect(signedIn("/")).toEqual({ action: "allow" });
    expect(signedIn("/api/scenes/1")).toEqual({ action: "allow" });
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/seasons/1?tab=a#b")).toBe("/seasons/1?tab=a#b");
  });

  it.each([
    ["absolute URL", "https://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["tab inside slashes", "/\t/evil.com"],
    ["no leading slash", "evil.com"],
    ["not a string", null],
  ])("falls back to home for %s", (_label, value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
