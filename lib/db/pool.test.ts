import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the database pool", () => {
  it("survives a dropped idle connection instead of crashing the server", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:password@localhost:5432/test");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pool } = await import("./index");

    expect(() => pool.emit("error", new Error("read ECONNRESET"))).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ECONNRESET"));

    await pool.end();
  });
});
