import { randomUUID } from "node:crypto";
import { clearLoginAttempts, expect, open, test } from "./support";

const anonymous = async (playwright: import("@playwright/test").PlaywrightWorkerArgs["playwright"], baseURL?: string) =>
  playwright.request.newContext({ baseURL, maxRedirects: 0 });

test.describe("public surface", () => {
  test("the health check answers without a login, and says nothing else", async ({ playwright, baseURL }) => {
    const request = await anonymous(playwright, baseURL);
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    await request.dispose();
  });

  test("robots.txt turns everything away", async ({ playwright, baseURL }) => {
    const request = await anonymous(playwright, baseURL);
    const response = await request.get("/robots.txt");

    expect(response.status()).toBe(200);
    expect(await response.text()).toMatch(/Disallow: \//);
    await request.dispose();
  });

  test("pages send a stranger to the login page, by a relative address", async ({ playwright, baseURL }) => {
    const request = await anonymous(playwright, baseURL);
    const response = await request.get("/lore", {
      headers: { host: "my-app.up.railway.app", "x-forwarded-host": "my-app.up.railway.app", "x-forwarded-proto": "https" },
    });

    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe("/login?next=%2Flore");
    await request.dispose();
  });

  test("the API refuses a stranger", async ({ playwright, baseURL }) => {
    const request = await anonymous(playwright, baseURL);
    for (const path of ["/api/search?q=a", "/api/backup", "/api/lore/deleted"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
    await request.dispose();
  });
});

test.describe("headers", () => {
  const check = (headers: Record<string, string>) => {
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  };

  test("are on pages, API responses and static files", async ({ playwright, baseURL }) => {
    const request = await anonymous(playwright, baseURL);
    const login = await request.get("/login");
    check(login.headers());
    expect(login.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    check((await request.get("/api/health")).headers());
    check((await request.get("/robots.txt")).headers());

    const asset = (await login.text()).match(/\/_next\/static\/[^"']+\.js/)?.[0];
    expect(asset).toBeTruthy();
    check((await request.get(asset!)).headers());
    await request.dispose();
  });

  test("pages say noindex themselves", async ({ page }) => {
    await open(page, "/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});

test.describe("login", () => {
  test("stops after 5 failures, with a friendly message", async ({ browser, baseURL }) => {
    const started = new Date();
    // A made-up address and email, so this can't lock anyone out.
    const context = await browser.newContext({ baseURL, extraHTTPHeaders: { "x-real-ip": `e2e-${randomUUID()}` } });
    const page = await context.newPage();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const attempt = async () => {
      await page.getByLabel("Email").fill(`e2e-${started.getTime()}@example.com`);
      await page.getByLabel("Password").fill("wrong");
      await page.getByRole("button", { name: /log in|sign in/i }).click();
    };

    for (let count = 1; count <= 5; count++) {
      await attempt();
      await expect(page.getByText("Wrong email or password.")).toBeVisible();
      await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeEnabled();
    }

    await attempt();
    await expect(page.getByText(/Too many attempts\. Please try again in 15 minutes\./)).toBeVisible();

    await context.close();
    await clearLoginAttempts(started);
  });
});

test.describe("error pages", () => {
  test("a missing page is friendly, with a way back", async ({ page }) => {
    await open(page, "/not-a-real-page");
    await expect(page.getByRole("heading", { name: "This page wandered off" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the library" })).toBeVisible();
  });

  test("a missing record is too", async ({ page }) => {
    await page.goto("/episodes/00000000-0000-0000-0000-000000000000");
    await expect(page.getByRole("heading", { name: "This page wandered off" })).toBeVisible();
  });
});
