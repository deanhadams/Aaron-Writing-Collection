export const MAX_USERS = 3;

export type SeedUser = {
  email: string;
  name: string;
  password: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseSeedUsers(raw: string | undefined): SeedUser[] {
  if (!raw) throw new Error("SEED_USERS is not set");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // The parser's message can quote the input, which holds passwords.
    throw new Error("SEED_USERS is not valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("SEED_USERS must be a JSON array");
  }
  if (parsed.length > MAX_USERS) {
    throw new Error(`SEED_USERS can hold at most ${MAX_USERS} users`);
  }

  return parsed.map((entry, index) => {
    const { email, name, password } = (entry ?? {}) as Partial<SeedUser>;
    if (
      !isNonEmptyString(email) ||
      !isNonEmptyString(name) ||
      !isNonEmptyString(password)
    ) {
      throw new Error(`SEED_USERS[${index}] needs email, name and password`);
    }
    if (password === "change-me") {
      throw new Error(`SEED_USERS[${index}] still has the placeholder password`);
    }
    return { email: email.trim().toLowerCase(), name: name.trim(), password };
  });
}
