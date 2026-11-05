import { expect, open, test, TOKEN } from "./support";

const palette = (page: import("@playwright/test").Page) => page.getByRole("dialog", { name: "Search everything" });
const input = (page: import("@playwright/test").Page) => page.getByRole("combobox", { name: /Search scenes/ });

test.describe("command palette", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/characters");
  });

  test("Ctrl+K opens it with the cursor ready, and Escape closes it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(palette(page)).toBeVisible();
    await expect(input(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(palette(page)).toBeHidden();
  });

  test("the top bar button opens it, and focus returns there", async ({ page }) => {
    const button = page.getByRole("button", { name: "Search" });
    await button.click();
    await expect(palette(page)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(button).toBeFocused();
  });

  test("shows grouped results with the match highlighted", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await input(page).fill(TOKEN);

    const option = page.getByRole("group", { name: "Scenes" }).getByRole("option").first();
    await expect(option).toBeVisible();
    await expect(option.locator("mark")).toHaveText(TOKEN);
    await expect(page.getByRole("group", { name: "Scenes" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "results" })).toBeAttached();
  });

  test("works by keyboard, and marks the active option", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await input(page).fill(TOKEN);
    await expect(page.getByRole("group", { name: "Scenes" })).toBeVisible();

    await page.keyboard.press("ArrowDown");
    const active = await input(page).getAttribute("aria-activedescendant");
    await expect(page.locator(`[id="${active}"]`)).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/scenes\/.+#beat-/);
    await expect(palette(page)).toBeHidden();
  });

  test("offers quick actions", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("option", { name: "New lore entry" })).toBeVisible();

    await input(page).fill("new lore");
    await page.getByRole("option", { name: "New lore entry" }).click();
    await expect(page).toHaveURL(/\/lore\?new=1/);
    await expect(page.getByRole("dialog", { name: "New lore entry" })).toBeVisible();
  });

  test("goes to an episode by number", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await input(page).fill("go to episode 2");
    await page.getByRole("option", { name: /Go to episode 2/ }).click();
    await expect(page).toHaveURL(/\/episodes\//);
  });

  test("says so when nothing matches", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await input(page).fill("zzqqxxvv");
    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });

  test("remembers recent searches", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await input(page).fill(TOKEN);
    await page.getByRole("group", { name: "Scenes" }).getByRole("option").first().click();
    await expect(page).toHaveURL(/#beat-/);

    await page.keyboard.press("Control+k");
    await expect(page.getByRole("group", { name: "Recent searches" })).toContainText(TOKEN);
  });
});

test.describe("opening a result", () => {
  test("lights up the exact line in the scene", async ({ page }) => {
    await open(page, `/search?q=${TOKEN}`);
    await page.getByRole("link", { name: "Alpha" }).click();

    await expect(page).toHaveURL(/\/scenes\/.+#beat-/);
    const hash = new URL(page.url()).hash.slice(1);
    await expect(page.locator(`[id="${hash}"]:visible`)).toHaveAttribute("data-flash", "");
    await expect(page.locator(`[id="${hash}"]:visible`)).toContainText(TOKEN);
  });

  test("opens in the reader if that is where the person last was", async ({ page, world }) => {
    await open(page, `/read/${world.seasonId}/${world.episodes[0].id}`);
    await open(page, `/search?q=${TOKEN}`);
    await page.getByRole("link", { name: "Alpha" }).click();

    await expect(page).toHaveURL(/\/read\/.+#beat-/);
    const hash = new URL(page.url()).hash.slice(1);
    await expect(page.locator(`[id="${hash}"]:visible`)).toHaveAttribute("data-flash", "");
  });

  test("opens in the editor if that is where the person last was", async ({ page, world }) => {
    await open(page, `/scenes/${world.scenes[1].id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await open(page, `/search?q=${TOKEN}`);
    await page.getByRole("link", { name: "Alpha" }).click();

    await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-pressed", "true");
    const hash = new URL(page.url()).hash.slice(1);
    await expect(page.locator(`li[id="${hash}"]:visible`)).toBeVisible();
  });
});

test.describe("results page", () => {
  test("shows a line in script style, with its speaker and place", async ({ page }) => {
    await open(page, `/search?q=${TOKEN}`);

    const hit = page.locator(".search-hit").first();
    await expect(hit.locator("mark")).toHaveText(TOKEN);
    await expect(hit.locator("strong")).toHaveText("DESRUC:");
    await expect(hit).toContainText("0:00 – 1:00");

    const font = await hit.locator(".search-snippet").evaluate((element) => getComputedStyle(element).fontFamily);
    expect(font).toMatch(/courier/i);
  });

  test("filters by speaker, kind and episode range, keeping them in the address", async ({ page }) => {
    await open(page, `/search?q=${TOKEN}&speaker=Desruc&kind=scene&from=1&to=1`);
    await expect(page.locator(".search-hit")).toHaveCount(1);

    await open(page, `/search?q=${TOKEN}&speaker=Nobody`);
    await expect(page.getByText("No results")).toBeVisible();

    await open(page, `/search?q=${TOKEN}&kind=outro`);
    await expect(page.getByText("No results")).toBeVisible();
  });

  test("the filter form runs a search", async ({ page }) => {
    await open(page, "/search");
    await page.getByRole("searchbox", { name: "Search" }).fill(TOKEN);
    await page.getByLabel("Sort").selectOption("episode");
    await page.getByRole("button", { name: "Search", exact: true }).last().click();

    await expect(page).toHaveURL(new RegExp(`q=${TOKEN}`));
    await expect(page.locator(".search-hit")).toHaveCount(1);
  });

  test("understands phrases, exclusions and speaker: in the box", async ({ page }) => {
    await open(page, `/search?q=${encodeURIComponent(`"${TOKEN}" -alpha`)}`);
    await expect(page.getByText("No results")).toBeVisible();

    await open(page, `/search?q=${encodeURIComponent(`${TOKEN} speaker:Desruc`)}`);
    await expect(page.locator(".search-hit")).toHaveCount(1);
  });

  test("shows ideas instead of a blank page", async ({ page }) => {
    await open(page, "/search");
    await expect(page.getByRole("heading", { name: "Find anything in the writing" })).toBeVisible();
    await expect(page.getByRole("link", { name: "speaker:Revoc" })).toBeVisible();
  });

  test("forgives a typo in real writing", async ({ page }) => {
    await open(page, "/search?q=Revok&type=characters");
    await expect(page.getByRole("link", { name: /REVOC/ })).toBeVisible();
  });

  test("the search route needs a signed-in person", async ({ playwright, baseURL }) => {
    const anonymous = await playwright.request.newContext({ baseURL });
    expect((await anonymous.get("/api/search?q=revoc")).status()).toBe(401);
    await anonymous.dispose();
  });

  for (const width of [320, 360, 390]) {
    test(`nothing runs past the edge at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await open(page, `/search?q=${TOKEN}`);

      const wide = await page.evaluate(() =>
        [...document.querySelectorAll("header *, main *")]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && box.right > innerWidth + 1 && !element.closest(".sr-only");
          })
          .map((element) => `${element.tagName}.${String(element.className).slice(0, 40)}`),
      );
      expect(wide).toEqual([]);
    });
  }
});
