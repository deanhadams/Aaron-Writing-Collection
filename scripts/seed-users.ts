import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { parseSeedUsers } from "../lib/auth/seed-users";

const BCRYPT_COST = 12;

async function main() {
  const seedUsers = parseSeedUsers(process.env.SEED_USERS);

  // Safe to re-run: an existing email gets its name and password updated.
  for (const { email, name, password } of seedUsers) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await db
      .insert(users)
      .values({ email, name, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, passwordHash },
      });
    console.log(`Seeded ${email}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
