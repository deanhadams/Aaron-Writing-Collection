import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const session = { userId: "user-1", name: "Aaron" };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("session tokens", () => {
  it("round-trips a session", async () => {
    const token = await createSessionToken(session);
    expect(await verifySessionToken(token)).toEqual(session);
  });

  it("rejects a missing or malformed token", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const [header, , signature] = (await createSessionToken(session)).split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "someone-else", name: "Mallory" }),
    ).toString("base64url");
    expect(await verifySessionToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const otherKey = new TextEncoder().encode("x".repeat(40));
    const token = await new SignJWT({ name: "Mallory" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setExpirationTime("1d")
      .sign(otherKey);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await createSessionToken(session);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("refuses to run with a missing or placeholder secret", async () => {
    vi.stubEnv("SESSION_SECRET", "change-me");
    await expect(verifySessionToken(undefined)).rejects.toThrow(/SESSION_SECRET/);
    await expect(createSessionToken(session)).rejects.toThrow(/SESSION_SECRET/);
  });
});
