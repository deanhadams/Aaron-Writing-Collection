// Everything worth knowing before pushing. Stops at the first failure.
//   npm run check:deploy
import { spawnSync } from "node:child_process";

const STEPS = [
  ["Lint", "npx eslint"],
  ["Type check", "npx tsc --noEmit"],
  ["Tests", "npx vitest run"],
  ["Environment schema", "npx tsx scripts/check-env.ts .env.example --sample"],
  ["Production build", "npx next build"],
];

const summary = [];

for (const [name, command] of STEPS) {
  console.log(`\n=== ${name}: ${command}`);
  const started = Date.now();
  const { status } = spawnSync(command, { shell: true, stdio: "inherit" });
  const seconds = ((Date.now() - started) / 1000).toFixed(0);

  summary.push(`${status === 0 ? "PASS" : "FAIL"}  ${name} (${seconds}s)`);
  if (status !== 0) {
    console.error(`\n${summary.join("\n")}\n\nStopped: ${name} failed.`);
    process.exit(1);
  }
}

console.log(`\n${summary.join("\n")}\n\nReady to push.`);
