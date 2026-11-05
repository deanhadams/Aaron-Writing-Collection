import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

function createPool() {
  const created = new Pool({ connectionString });

  // Neon closes idle connections. With no listener, that error would be uncaught
  // and stop the whole server. The pool drops the client and makes a new one.
  created.on("error", (error) => console.warn(`database connection lost: ${error.message}`));
  return created;
}

// One pool per process, reused across dev hot reloads.
const globalForDb = globalThis as unknown as { pool?: Pool };
export const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
