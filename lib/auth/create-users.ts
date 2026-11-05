import bcrypt from "bcryptjs";
import { inArray } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Database } from "@/lib/scenes/save-scene";
import type { SeedUser } from "./seed-users";

const BCRYPT_COST = 12;

/** Adds only the people who don't exist yet. An existing password is never touched. */
export async function createMissingUsers(db: Database, seedUsers: SeedUser[], cost = BCRYPT_COST) {
  const existing = await db
    .select({ email: users.email })
    .from(users)
    .where(inArray(users.email, seedUsers.map(({ email }) => email)));
  const taken = new Set(existing.map(({ email }) => email));

  const created: string[] = [];
  for (const { email, name, password } of seedUsers) {
    if (taken.has(email)) continue;

    const passwordHash = await bcrypt.hash(password, cost);
    const inserted = await db
      .insert(users)
      .values({ email, name, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ email: users.email });
    created.push(...inserted.map((row) => row.email));
  }

  return { created, skipped: [...taken] };
}
