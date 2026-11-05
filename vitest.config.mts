import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // The first test in a file also runs every migration once.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Those are Playwright's, and need a browser: npm run test:e2e.
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
    env: { SESSION_SECRET: "test-secret-that-is-at-least-32-characters" },
  },
});
