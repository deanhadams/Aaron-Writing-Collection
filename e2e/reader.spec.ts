import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import mammoth from "mammoth";
import { clearBackupLog, expect, open, reopen, test } from "./support";

const scrollSceneToTop = (page: import("@playwright/test").Page, id: string) =>
  page.evaluate((sceneId) => {
    document.getElementById(`scene-${sceneId}`)?.scrollIntoView({ behavior: "instant", block: "start" });
  }, id);

const topScene = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const sections = [...document.querySelectorAll<HTMLElement>("[data-scene]")];
    return sections.filter((section) => section.getBoundingClientRect().top <= 104).at(-1)?.querySelector("h3")?.textContent;
  });

test.describe("reader", () => {
  test("shows the script like the Word source, without the app's chrome", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);

    await expect(page.locator(".rd-title:visible")).toHaveText("EPISODE 1: Opening Night");
    await expect(page.locator(".rd-heading").first()).toHaveText("Scene 1: Alpha");
    await expect(page.locator(".rd-time").first()).toHaveText("(0:00 - 1:00)");
    await expect(page.locator(".rd-line").first()).toHaveText("REVOC: Alpha line");
    await expect(page.locator(".topbar")).toBeHidden();

    const font = await page.locator(".rd-page").evaluate((element) => getComputedStyle(element).fontFamily);
    expect(font).toMatch(/courier/i);
  });

  test("the app's top bar comes back after leaving the reader", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await expect(page.locator(".topbar")).toBeHidden();

    await page.getByRole("link", { name: "Back to the library" }).click();
    await expect(page).toHaveURL(/episodes/);
    await expect(page.locator(".topbar")).toBeVisible();

    await page.goBack();
    await expect(page.locator(".topbar")).toBeHidden();
  });

  test("the season reader holds every episode", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}`);
    await expect(page.locator(".rd-title:visible")).toHaveCount(3);
  });

  test("the contents drawer jumps to a scene", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.getByRole("button", { name: "Contents" }).click();
    await page.locator(".rd-toc-scene").filter({ hasText: "Charlie" }).click();

    await expect(page).toHaveURL(new RegExp(`#scene-${world.scenes[2].id}$`));
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the contents drawer reaches another episode", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.getByRole("button", { name: "Contents" }).click();
    await page.locator(".rd-toc-episode").filter({ hasText: "Third Act" }).click();

    await expect(page).toHaveURL(new RegExp(`/read/${world.seasonId}/${world.episodes[2].id}$`));
    await expect(page.locator(".rd-title:visible")).toContainText("Third Act");
  });

  test("next and previous episode buttons", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.getByRole("link", { name: "Next episode" }).click();
    await expect(page.locator(".rd-title:visible")).toContainText("Second Act");

    await page.getByRole("link", { name: "Previous episode" }).click();
    await expect(page.locator(".rd-title:visible")).toContainText("Opening Night");
  });

  test("settings apply straight away and survive a reload", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.getByRole("button", { name: "Reader settings" }).click();
    await page.getByRole("radio", { name: "Huge" }).check();
    await page.getByRole("radio", { name: "Relaxed" }).check();
    await page.getByLabel("Character colors").uncheck();
    await page.getByLabel("Show timecodes").uncheck();
    await page.getByRole("button", { name: "Done" }).click();

    const check = async () => {
      await expect(page.locator(".rd-page")).toHaveCSS("font-size", "24px");
      await expect(page.locator(".rd-page")).toHaveCSS("line-height", "48px");
      await expect(page.locator(".rd-time").first()).toBeHidden();
      await expect(page.locator(".reader")).toHaveAttribute("data-colors", "off");
    };
    await check();
    await reopen(page);
    await check();
  });

  test("J and K move between scenes, and arrow keys too", async ({ page, world }) => {
    await page.setViewportSize({ width: 1280, height: 300 });
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.addStyleTag({ content: "html { scroll-behavior: auto !important; } .rd-scene { min-height: 900px; }" });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.keyboard.press("j");
    await expect.poll(() => topScene(page)).toBe("Scene 1: Alpha");
    await page.keyboard.press("j");
    await expect.poll(() => topScene(page)).toBe("Scene 2: Bravo");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => topScene(page)).toBe("Scene 3: Charlie");
    await page.keyboard.press("k");
    await expect.poll(() => topScene(page)).toBe("Scene 2: Bravo");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => topScene(page)).toBe("Scene 1: Alpha");
  });

  test("[ and ] move between episodes", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.keyboard.press("]");
    await expect(page.locator(".rd-title:visible")).toContainText("Second Act");
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("[");
    await expect(page.locator(".rd-title:visible")).toContainText("Opening Night");
  });

  test("reader keys are ignored while a dialog is open", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.getByRole("button", { name: "Reader settings" }).click();
    await page.keyboard.press("]");
    await expect(page.locator(".rd-title:visible")).toContainText("Opening Night");
  });

  test("the progress bar follows the page", async ({ page, world }) => {
    await page.setViewportSize({ width: 1280, height: 300 });
    await open(page, `/read/${world.seasonId}`);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));

    await expect.poll(() => page.locator(".rd-progress span").evaluate((bar) => bar.style.transform)).toBe("scaleX(1)");
  });

  test("Read from the start, and Continue where I left off", async ({ page, world }) => {
    await open(page, `/seasons/${world.seasonId}`);
    await expect(page.getByRole("link", { name: "Read from the start" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Continue where I left off/ })).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 300 });
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    const saved = page.waitForResponse((r) => r.url().includes("/api/reader/progress"));
    await scrollSceneToTop(page, world.scenes[1].id);
    expect((await saved).status()).toBe(200);

    await open(page, `/seasons/${world.seasonId}`);
    const link = page.getByRole("link", { name: /Continue where I left off \(Episode 1\)/ });
    await expect(link).toHaveAttribute("href", `/read/${world.seasonId}/${world.episodes[0].id}#scene-${world.scenes[1].id}`);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`#scene-${world.scenes[1].id}$`));
    await expect(page.locator(".rd-title:visible")).toBeVisible();
  });

  test("works on a phone", async ({ page, world }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);

    const wide = await page.evaluate(() =>
      [...document.querySelectorAll(".reader *")].filter((element) => element.getBoundingClientRect().right > innerWidth + 1).length,
    );
    expect(wide).toBe(0);
  });
});

test.describe("print", () => {
  test("hides the navigation and breaks before each episode", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}`);
    await page.emulateMedia({ media: "print" });

    await expect(page.locator(".rd-header")).toBeHidden();
    await expect(page.locator(".rd-start")).toBeHidden();
    await expect(page.locator(".mesh")).toBeHidden();
    await expect(page.locator(".rd-episode").nth(1)).toHaveCSS("break-before", "page");
    await expect(page.locator(".rd-line").first()).toHaveCSS("break-inside", "avoid");
    await expect(page.locator(".rd-line").first()).toHaveCSS("color", "rgb(0, 0, 0)");
  });

  test("makes a PDF with one page per episode at least", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}`);
    const pdf = await page.pdf({ preferCSSPageSize: true });
    const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(3);
  });
});

test.describe("Word export", () => {
  // The full comparison against the importer is in lib/export/export.test.ts.
  const wordText = async (path: string | Promise<string>) =>
    (await mammoth.extractRawText({ buffer: await readFile(await path) })).value;

  test("downloads a season from the season page", async ({ page, world }) => {
    await open(page, `/seasons/${world.seasonId}`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download Word" }).click()]);

    expect(download.suggestedFilename()).toMatch(/season-\d+\.docx$/);
    const text = await wordText(download.path());
    expect(text.match(/^EPISODE [0-9]+:/gm)).toHaveLength(3);
    expect(text).toContain("Scene 1: Alpha");
  });

  test("downloads an episode from the episode page", async ({ page, world }) => {
    await open(page, `/episodes/${world.episodes[0].id}`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download Word" }).click()]);

    expect(download.suggestedFilename()).toMatch(/episode-1-opening-night\.docx$/);
    const text = await wordText(download.path());
    expect(text.match(/^EPISODE [0-9]+:/gm)).toEqual(["EPISODE 1:"]);
    expect(text.match(/^Scene [0-9]+: [A-Za-z]+/gm)).toEqual(["Scene 1: Alpha", "Scene 2: Bravo", "Scene 3: Charlie"]);
    expect(text).toContain("REVOC: Alpha line");
  });

  test("downloads from the reader's menu", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await page.getByRole("button", { name: "Print and export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: "Download Word" }).click()]);

    expect(download.suggestedFilename()).toMatch(/\.docx$/);
  });

  test("needs a signed-in person", async ({ playwright, baseURL, world }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    for (const path of [`/api/export/seasons/${world.seasonId}`, `/api/export/episodes/${world.episodes[0].id}`, "/api/backup"]) {
      expect((await anonymous.get(path)).status(), path).toBe(401);
    }
    await anonymous.dispose();
  });
});

test.describe("backup", () => {
  test("Download everything gives a dated zip with content, Word files and a manifest", async ({ page, world }) => {
    const started = new Date();
    await open(page, `/seasons/${world.seasonId}`);
    await page.getByRole("button", { name: "Account menu" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 45_000 }),
      page.getByRole("menuitem", { name: "Download everything" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^aarons-writing-collection-backup-\d{4}-\d{2}-\d{2}\.zip$/);

    const files = unzipSync(new Uint8Array(await readFile(await download.path())));
    const manifest = JSON.parse(strFromU8(files["manifest.json"]));

    expect(Object.keys(files)).toContain("content/scenes.json");
    expect(manifest.documents.length).toBeGreaterThanOrEqual(2);
    expect(JSON.parse(strFromU8(files["content/scenes.json"]))).toHaveLength(manifest.counts.scenes);
    expect(strFromU8(files["content/scenes.json"])).toContain(world.scenes[0].id);

    await clearBackupLog(started);
  });
});
