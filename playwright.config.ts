import { defineConfig } from "@playwright/test";

// Point E2E_BASE_URL at a running site to test that address instead.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

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
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run dev", url: `${baseURL}/login`, reuseExistingServer: true, timeout: 120_000 },
});
