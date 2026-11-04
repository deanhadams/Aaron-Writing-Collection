import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Those are Playwright's, and need a browser: npm run test:e2e.
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
    env: { SESSION_SECRET: "test-secret-that-is-at-least-32-characters" },
  },
});
