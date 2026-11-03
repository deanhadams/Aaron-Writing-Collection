import { describe, expect, it } from "vitest";
import { parseSeedUsers } from "./seed-users";

const user = (email: string) => ({ email, name: "A", password: "secret" });

describe("parseSeedUsers", () => {
  it("normalises emails", () => {
    const raw = JSON.stringify([user(" Dean@Example.com ")]);
    expect(parseSeedUsers(raw)[0].email).toBe("dean@example.com");
  });

  it("rejects more than three users", () => {
    const raw = JSON.stringify(["a", "b", "c", "d"].map(user));
    expect(() => parseSeedUsers(raw)).toThrow(/at most 3/);
  });

  it("rejects missing fields and placeholder passwords", () => {
    expect(() => parseSeedUsers('[{"email":"a@b.c"}]')).toThrow(/needs email/);
    expect(() =>
      parseSeedUsers('[{"email":"a@b.c","name":"A","password":"change-me"}]'),
    ).toThrow(/placeholder/);
  });

  it("does not echo invalid JSON, which may contain passwords", () => {
    expect(() => parseSeedUsers("{hunter2")).toThrow("SEED_USERS is not valid JSON");
  });

  it("rejects an unset variable", () => {
    expect(() => parseSeedUsers(undefined)).toThrow(/not set/);
  });
});
