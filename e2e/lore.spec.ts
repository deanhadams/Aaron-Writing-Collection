import type { Page } from "@playwright/test";
import { chooseFromMenu, createLoreEntry, editLoreEntry, expect, open, reopen, saves, test } from "./support";

const body = (page: Page) => page.getByRole("combobox", { name: /Entry text/ });

const saved = (page: Page) => expect(page.locator(".save-indicator")).toHaveAttribute("data-status", "saved", { timeout: 10_000 });

test.describe("lore gallery", () => {
  test("groups entries by category, and filters them", async ({ page }) => {
    await createLoreEntry("E2E Rift", "Places");
    await open(page, "/lore");

    await expect(page.getByRole("heading", { name: "Places" })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Rift/ })).toBeVisible();

    await page.getByRole("searchbox", { name: "Filter lore" }).fill("nothing like this");
    await expect(page.getByRole("heading", { name: "Nothing matches" })).toBeVisible();
  });

  test("a new entry opens in the editor", async ({ page }) => {
    await open(page, "/lore");
    await page.getByRole("button", { name: "New entry" }).click();
    await page.getByLabel("Title").fill("E2E Fresh");
    await page.getByLabel("Category").selectOption("Items");
    await page.getByRole("button", { name: "Create entry" }).click();

    await expect(page).toHaveURL(/\/lore\/e2e-fresh\/edit/);
    await expect(body(page)).toHaveValue("Add details here…");
  });

  test("filters by tag", async ({ page }) => {
    await createLoreEntry("E2E Tagged", "Items", { tags: ["e2e-tag"] });
    await createLoreEntry("E2E Plain", "Items");
    await open(page, "/lore");

    await page.getByRole("button", { name: "e2e-tag" }).click();
    await expect(page.getByRole("link", { name: /E2E Tagged/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /E2E Plain/ })).toHaveCount(0);
  });
});

test.describe("lore entry", () => {
  test("renders markdown: headings, lists, tables, quotes, emphasis", async ({ page }) => {
    await createLoreEntry("E2E Rich", "World", {
      body: "## First\n\nSome **bold** and *italic*.\n\n- one\n- two\n\n> A quote\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n## Second\n\n### Third\n\n<script>window.hacked = true</script>",
    });
    await open(page, "/lore/e2e-rich");

    const prose = page.locator(".lore-prose");
    await expect(prose.getByRole("heading", { name: "First" })).toBeVisible();
    await expect(prose.locator("strong")).toHaveText("bold");
    await expect(prose.locator("em")).toHaveText("italic");
    await expect(prose.locator("li")).toHaveCount(2);
    await expect(prose.locator("blockquote")).toContainText("A quote");
    await expect(prose.locator("td")).toHaveCount(2);
    expect(await page.evaluate(() => "hacked" in window)).toBe(false);

    const contents = page.getByRole("navigation", { name: "On this page" });
    await expect(contents.getByRole("link")).toHaveCount(3);
  });

  test("[[links]] become chips, coloured for a character", async ({ page }) => {
    await createLoreEntry("E2E Target", "World");
    await createLoreEntry("E2E Linker", "World", { body: "See [[E2E Target]] and [[DESRUC]]." });
    await open(page, "/lore/e2e-linker");

    const prose = page.locator(".lore-prose");
    await expect(prose.getByRole("link", { name: "E2E Target" })).toHaveAttribute("href", "/lore/e2e-target");
    await expect(prose.getByRole("link", { name: "DESRUC" })).toHaveAttribute("href", /\/characters\//);
    await expect(prose.getByRole("link", { name: "DESRUC" })).toHaveAttribute("style", /--char/);
  });

  test("an unknown [[link]] offers to create the entry", async ({ page }) => {
    await createLoreEntry("E2E Asker", "World", { body: "About [[E2E Unwritten]]." });
    await open(page, "/lore/e2e-asker");

    await expect(page.getByText("no entry yet")).toBeVisible();
    await page.getByRole("button", { name: "Create entry for E2E Unwritten" }).click();
    await expect(page).toHaveURL(/\/lore\/e2e-unwritten\/edit/);
  });

  test("shows entries linked both ways", async ({ page }) => {
    await createLoreEntry("E2E Hub", "World", { body: "To [[E2E Out]]." });
    await createLoreEntry("E2E Out", "World");
    await createLoreEntry("E2E In", "World", { body: "From [[E2E Hub]]." });
    await open(page, "/lore/e2e-hub");

    const related = page.getByRole("region", { name: "Related" });
    await expect(related.getByRole("link", { name: "E2E Out" })).toBeVisible();
    await expect(related.getByRole("link", { name: "E2E In" })).toBeVisible();
  });

  test("lists the scenes that mention it", async ({ page, world }) => {
    await createLoreEntry("Alpha line", "World");
    await open(page, "/lore/alpha-line");

    const mentions = page.getByRole("region", { name: "Mentioned in" });
    await expect(mentions.getByRole("link").first()).toHaveAttribute("href", `/scenes/${world.scenes[0].id}`);
  });
});

test.describe("lore editor", () => {
  test("autosaves, and the preview follows the text", async ({ page }) => {
    await createLoreEntry("E2E Auto", "World");
    await open(page, "/lore/e2e-auto/edit");

    await body(page).fill("## Written\n\nFresh **text**.");
    await expect(page.locator(".lore-preview").getByRole("heading", { name: "Written" })).toBeVisible();
    await saved(page);

    await reopen(page);
    await expect(body(page)).toHaveValue("## Written\n\nFresh **text**.");
  });

  test("the toolbar formats the selection", async ({ page }) => {
    await createLoreEntry("E2E Tools", "World");
    await open(page, "/lore/e2e-tools/edit");

    await body(page).fill("word");
    await body(page).selectText();
    await page.getByRole("button", { name: "Bold" }).click();
    await expect(body(page)).toHaveValue("**word**");

    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.locator(".lore-preview table")).toBeVisible();
  });

  test("[[ autocompletes names by keyboard", async ({ page }) => {
    await createLoreEntry("E2E Complete Me", "World");
    await open(page, "/lore/e2e-complete-me/edit");

    await body(page).fill("");
    await body(page).pressSequentially("See [[E2E Comp");
    await expect(page.getByRole("option", { name: /E2E Complete Me/ })).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(body(page)).toHaveValue("See [[E2E Complete Me]]");
    await expect(page.locator(".lore-preview").getByRole("link", { name: "E2E Complete Me" })).toBeVisible();
  });

  test("shows the conflict message when someone saved first", async ({ page, context }) => {
    const { id } = await createLoreEntry("E2E Clash", "World");
    await open(page, "/lore/e2e-clash/edit");
    await editLoreEntry(id, "Their words.");

    await body(page).fill("My words.");
    const alert = page.getByRole("alertdialog");
    await expect(alert).toContainText("Someone else edited this entry", { timeout: 10_000 });

    await alert.getByRole("button", { name: "Reload their version" }).click();
    await expect(body(page)).toHaveValue("Their words.");
    void context;
  });

  test("History restores an earlier version", async ({ page }) => {
    await createLoreEntry("E2E Past", "World");
    await open(page, "/lore/e2e-past/edit");

    await body(page).fill("Second version.");
    await saved(page);
    await page.getByRole("button", { name: "History" }).click();
    await page.locator(".history-row").first().click();
    await saves(page, () => page.getByRole("button", { name: "Restore this version" }).click());

    await expect(body(page)).toHaveValue("Add details here…");
    await reopen(page);
    await expect(body(page)).toHaveValue("Add details here…");
  });

  test("delete, then restore from Recently deleted", async ({ page }) => {
    await createLoreEntry("E2E Gone", "World");
    await open(page, "/lore/e2e-gone/edit");
    await page.getByRole("button", { name: "Delete this entry" }).click();
    await saves(page, () => page.getByRole("button", { name: "Delete", exact: true }).click());

    await expect(page).toHaveURL(/\/lore$/);
    await expect(page.getByRole("link", { name: /E2E Gone/ })).toHaveCount(0);

    await chooseFromMenu(page, "Lore menu", "Recently deleted");
    await saves(page, () => page.getByRole("button", { name: "Restore E2E Gone" }).click());
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("link", { name: /E2E Gone/ })).toBeVisible();
  });

  test("uses tabs on a phone", async ({ page }) => {
    await createLoreEntry("E2E Phone", "World");
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, "/lore/e2e-phone/edit");

    await expect(body(page)).toBeVisible();
    await expect(page.locator(".lore-preview")).toBeHidden();

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.locator(".lore-preview")).toBeVisible();
    await expect(body(page)).toBeHidden();
  });
});
