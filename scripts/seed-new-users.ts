// Creates the accounts in SEED_USERS that don't exist yet. Safe to run on a live
// site: it never changes an existing account or password.
//   npm run db:seed:users
import { parseSeedUsers } from "../lib/auth/seed-users";

async function main() {
  const seedUsers = parseSeedUsers(process.env.SEED_USERS);
  const [{ db }, { createMissingUsers }] = await Promise.all([import("../lib/db"), import("../lib/auth/create-users")]);

  const { created, skipped } = await createMissingUsers(db, seedUsers);
  for (const email of created) console.log(`Created ${email}`);
  for (const email of skipped) console.log(`Already exists, left alone: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
