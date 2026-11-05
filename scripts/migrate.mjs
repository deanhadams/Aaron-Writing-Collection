// Applies database migrations, and is safe to run any number of times: each one
// is recorded, and only those not yet recorded run. Railway runs this before each
// deploy, so it uses production dependencies only.
//   npm run db:migrate
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
pool.on("error", () => {});

const applied = async () => {
  const { rows } = await pool.query(`SELECT to_regclass('drizzle.__drizzle_migrations') AS tracked`);
  if (rows[0].tracked === null) return 0;

  const { rows: counted } = await pool.query(`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`);
  return counted[0].total;
};

try {
  const before = await applied();
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const after = await applied();

  console.log(`Migrations: ${after} applied, ${after - before} new this run`);
  await pool.end();
} catch (error) {
  // Only the message: the error object can carry connection details.
  console.error(`Migration failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}
