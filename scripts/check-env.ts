// Checks a file of environment variables against the app's schema.
//   tsx scripts/check-env.ts .env.example --sample
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { envProblems, OPTIONAL_ENV, REQUIRED_ENV } from "../lib/env";

const file = process.argv[2] ?? ".env.example";
const values = parse(readFileSync(file));

const problems = envProblems(values, { sample: process.argv.includes("--sample") });
const undocumented = [...REQUIRED_ENV, ...OPTIONAL_ENV].filter((name) => !(name in values));

for (const problem of problems) console.error(`  - ${problem}`);
for (const name of undocumented) console.error(`  - ${name} is not listed in ${file}`);

if (problems.length > 0 || undocumented.length > 0) process.exit(1);
console.log(`${file}: all ${REQUIRED_ENV.length} required variables present and valid, ${OPTIONAL_ENV.length} optional listed`);
