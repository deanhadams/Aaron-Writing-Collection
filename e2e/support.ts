import { createHmac } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import dotenv from "dotenv";
import { and, eq, gte, like, or } from "drizzle-orm";
import type { LoreCategory as LoreCategoryName } from "@/lib/lore/categories";

dotenv.config({ path: ".env.local", quiet: true });

const E2E_TITLE = "E2E";

/** A word no real scene will ever use, so search tests find only their own scene. */
export const TOKEN = "zanzibarquill";
const FIRST_E2E_SEASON = 9000;

type World = {
  seasonId: string;
  episodes: { id: string; title: string }[];
  scenes: { id: string; title: string }[];
};

// Loaded here, after dotenv, because the database reads its address on import.
const database = async () => {
  const [{ db }, schema] = await Promise.all([import("@/lib/db"), import("@/lib/db/schema")]);
  return { db, ...schema };
};

/** Crashed runs leave their season behind, so each run clears those first. */
async function clearSeasons() {
  const { db, loreEntries, seasons } = await database();
  await db.delete(seasons).where(and(eq(seasons.title, E2E_TITLE), gte(seasons.number, FIRST_E2E_SEASON)));
  await db.delete(loreEntries).where(or(like(loreEntries.title, "E2E %"), eq(loreEntries.title, "Alpha line")));
}

/** Made directly, so a lore test starts on the feature it is about. */
export async function createLoreEntry(title: string, category: LoreCategoryName, fields: { body?: string; tags?: string[] } = {}) {
  const { db, loreEntries, series } = await database();
  const [show] = await db.select().from(series).limit(1);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const [created] = await db
    .insert(loreEntries)
    .values({ seriesId: show.id, title, slug, category, body: fields.body ?? "Add details here…", tags: fields.tags ?? [] })
    .returning({ id: loreEntries.id, slug: loreEntries.slug });
  return created;
}

/** Another person's save, arriving behind the editor's back. */
export async function editLoreEntry(id: string, body: string) {
  const { db, loreEntries } = await database();
  await db.update(loreEntries).set({ body, version: 2 }).where(eq(loreEntries.id, id));
}

/** A throwaway season, so no test ever touches real writing. */
async function seedWorld(): Promise<World> {
  const { db, episodes, scenes, seasons, series } = await database();
  await clearSeasons();

  const [show] = await db.select().from(series).limit(1);
  const [season] = await db
    .insert(seasons)
    .values({ seriesId: show.id, number: FIRST_E2E_SEASON, title: E2E_TITLE })
    .returning();

  const made = await db
    .insert(episodes)
    .values(
      ["Opening Night", "Second Act", "Third Act"].map((title, index) => ({
        seasonId: season.id,
        number: index + 1,
        title,
        status: "drafting" as const,
      })),
    )
    .returning();

  const line = (text: string) => ({ id: crypto.randomUUID(), type: "dialogue" as const, character: "REVOC", text });
  const list = await db
    .insert(scenes)
    .values(
      ["Alpha", "Bravo", "Charlie"].map((title, index) => ({
        episodeId: made[0].id,
        position: index + 1,
        title,
        timecode: `${index}:00 - ${index + 1}:00`,
        beats:
          title === "Alpha"
            ? [line(`${title} line`), { ...line(`The word is ${TOKEN} today.`), character: "DESRUC" }]
            : [line(`${title} line`)],
      })),
    )
    .returning();

  return {
    seasonId: season.id,
    episodes: made.map(({ id, title }) => ({ id, title })),
    scenes: list.map(({ id, title }) => ({ id, title: title ?? "" })),
  };
}

/** The same token the login page issues, signed here because jose will not load in Playwright. */
function sessionToken(userId: string, name: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: "HS256" })}.${encode({ name, sub: userId, iat: now, exp: now + 3600 })}`;
  const signature = createHmac("sha256", process.env.SESSION_SECRET!).update(body).digest("base64url");
  return `${body}.${signature}`;
}

/** The backup test's own log row, so test runs don't read as real backups. */
export async function clearBackupLog(since: Date) {
  const { db, backupsLog } = await database();
  await db.delete(backupsLog).where(gte(backupsLog.createdAt, since));
}

export async function clearLoginAttempts(since: Date) {
  const { db, loginAttempts } = await database();
  await db.delete(loginAttempts).where(gte(loginAttempts.attemptedAt, since));
}

export async function signInCookie(url: string) {
  const { db, users } = await database();
  const [user] = await db.select().from(users).limit(1);
  return { name: "session", value: sessionToken(user.id, user.name), url };
}

// Characters with no portrait yet are ordinary 404s from the bucket.
const isExpected = (url: string, status: number) =>
  url.includes(".r2.dev") || status === 409 || status === 422 || (status === 404 && url.endsWith("/not-a-real-page"));

export const test = base.extend<{ world: World }>({
  world: async ({}, provide) => {
    const world = await seedWorld();
    await provide(world);
    await clearSeasons();
  },

  page: async ({ page, context, baseURL, world }, provide, testInfo) => {
    await context.addCookies([await signInCookie(baseURL!)]);
    void world;

    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(`page error: ${error.message.slice(0, 300)}`));
    page.on("console", (message) => {
      if (message.type() === "error" && !/Failed to load resource|WebSocket/.test(message.text())) {
        problems.push(`console: ${message.text().slice(0, 300)}`);
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && !isExpected(response.url(), response.status())) {
        problems.push(`network: ${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });

    await provide(page);

    await testInfo.attach("problems", { body: JSON.stringify(problems), contentType: "application/json" });
    expect(problems, "no console errors or failed requests").toEqual([]);
  },
});

export { expect };

/** Waits until React has taken over, because a page can look finished without it. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await reactReady(page);
}

/** A reload, to prove a change reached the database and not just the screen. */
export async function reopen(page: Page) {
  await page.reload();
  await reactReady(page);
}

async function reactReady(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(
    () => {
      const button = document.querySelector("main button, main a");
      return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    },
    undefined,
    { timeout: 15_000 },
  );
}

/** Runs a click that must save, and fails unless the server accepted it. */
export async function saves(page: Page, action: () => Promise<unknown>) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/") && r.request().method() !== "GET", { timeout: 8_000 }),
    action(),
  ]);
  expect(response.status(), `${response.request().method()} ${response.url()}`).toBeLessThan(300);
  return response;
}

export const episodeCard = (page: Page, title: string) => page.locator(".sort-row:visible").filter({ hasText: title });

export const sceneRow = episodeCard;

export async function episodeOrder(page: Page) {
  return page.locator(".sort-row:visible").evaluateAll((rows) =>
    rows.map((row) => {
      const number = row.querySelector(".ep-numeral-fill")?.textContent;
      return `${number}:${row.querySelector(".ep-title")?.firstChild?.textContent}`;
    }),
  );
}

export const sceneOrder = (page: Page) =>
  page.locator(".sort-row:visible").evaluateAll((rows) => rows.map((row) => row.querySelector("h2")?.textContent));

export async function chooseFromMenu(page: Page, button: string, item: string) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

/** dnd-kit listens for real pointer movement, so this drags with the real mouse. */
export async function dragBetween(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.waitForTimeout(200);
  await page.mouse.up();
}
