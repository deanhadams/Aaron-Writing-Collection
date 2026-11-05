import { defineConfig } from "@playwright/test";

// npm run test:e2e:prod tests a production build on its own port, started and stopped here.
// Otherwise E2E_BASE_URL picks a running site, and the default is the dev server.
const PRODUCTION_PORT = 3200;
const isProduction = process.env.npm_lifecycle_event === "test:e2e:prod";
const baseURL = isProduction ? `http://localhost:${PRODUCTION_PORT}` : (process.env.E2E_BASE_URL ?? "http://localhost:3000");

export default defineConfig({
  testDir: "./e2e",
  // Every test changes the database, so they run one at a time.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL,
    channel: "msedge",
    viewport: { width: 1280, height: 900 },
    actionTimeout: 8_000,
  },
  webServer: isProduction
    ? { command: `npx next start -p ${PRODUCTION_PORT}`, url: `${baseURL}/login`, timeout: 60_000 }
    : process.env.E2E_BASE_URL
      ? undefined
      : { command: "npm run dev", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 120_000 },
});
