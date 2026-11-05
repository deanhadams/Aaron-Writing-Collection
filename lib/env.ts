import { z } from "zod";

const present = z.string().trim().min(1, "is missing");

const httpsUrl = present.refine((value) => URL.canParse(value) && /^https?:/.test(value), "must be a full http or https address");

export const envSchema = z.object({
  DATABASE_URL: present.refine((value) => /^postgres(ql)?:\/\//.test(value), "must start with postgresql://"),
  SESSION_SECRET: present.min(32, "must be at least 32 characters"),
  R2_ACCOUNT_ID: present,
  R2_ACCESS_KEY_ID: present,
  R2_SECRET_ACCESS_KEY: present,
  R2_BUCKET: present,
  R2_PUBLIC_URL: httpsUrl,
});

/** Read if set, but the app runs without them. SEED_USERS is checked by the seed scripts. */
export const OPTIONAL_ENV = ["SEED_USERS", "APP_ENV_LABEL", "PRODUCTION_DB_HOST_HINT"] as const;

export const REQUIRED_ENV = Object.keys(envSchema.shape) as (keyof typeof envSchema.shape)[];

const PLACEHOLDER = /replace-with|change-me/i;

/**
 * Everything wrong with an environment, as variable names and rules. Values
 * never appear here, so this is safe to print in deploy logs.
 *
 * sample: checks the shape of .env.example, whose values are placeholders on
 * purpose. A real start refuses them: a published SESSION_SECRET would let
 * anyone forge a login.
 */
export function envProblems(env: Record<string, string | undefined>, { sample = false } = {}) {
  const result = envSchema.safeParse(env);
  const problems = result.success
    ? []
    : result.error.issues.map((issue) => `${String(issue.path[0])} ${issue.message.replace(/^Invalid input.*$/, "is missing")}`);

  if (!sample) {
    for (const name of REQUIRED_ENV) {
      if (PLACEHOLDER.test(env[name] ?? "")) problems.push(`${name} still has its placeholder value`);
    }
  }

  return [...new Set(problems)];
}

export function assertEnv(env: Record<string, string | undefined> = process.env) {
  const problems = envProblems(env);
  if (problems.length === 0) return;

  console.error(`Cannot start: fix these environment variables.\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}

const hostOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    return "";
  }
};

/**
 * The words for the warning banner, or null. Only ever a label: the banner must
 * not show the address, which holds the database password.
 */
export function productionDbLabel(env: Record<string, string | undefined>) {
  const hint = env.PRODUCTION_DB_HOST_HINT?.trim().toLowerCase();
  if (env.NODE_ENV !== "development" || !hint || !hostOf(env.DATABASE_URL).includes(hint)) return null;
  return env.APP_ENV_LABEL?.trim() || "Production database";
}
