import { chooseFromMenu, dragBetween, expect, open, reopen, saves, sceneOrder, sceneRow, test } from "./support";

const STARTING_ORDER = ["Alpha", "Bravo", "Charlie"];

test.describe("episode page", () => {
  test.beforeEach(async ({ page, world }) => {
    await open(page, `/episodes/${world.episodes[0].id}`);
  });

  test("add a scene at a position, with a kind", async ({ page }) => {
    await page.getByRole("button", { name: "Add a scene after Alpha" }).click();
    await page.getByRole("radio", { name: "Post-credit" }).check();
    await page.getByLabel("Title (optional)").fill("Inserted");
    await saves(page, () => page.getByRole("button", { name: "Add scene" }).click());

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(["Alpha", "Inserted", "Bravo", "Charlie"]);
    await expect(page.locator('.sort-row[data-kind="post_credit"]')).toHaveCount(1);
  });

  test("rename and change kind", async ({ page }) => {
    await chooseFromMenu(page, "Options for Bravo", "Rename or change kind");
    await page.getByLabel("Title").fill("Renamed");
    await page.getByRole("radio", { name: "Outro" }).check();
    await saves(page, () => page.getByRole("button", { name: "Save", exact: true }).click());

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(["Alpha", "Renamed", "Charlie"]);
    await expect(page.locator('.sort-row[data-kind="outro"]')).toHaveCount(1);
  });

  test("duplicate", async ({ page }) => {
    await saves(page, () => chooseFromMenu(page, "Options for Alpha", "Duplicate"));

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(["Alpha", "Alpha (copy)", "Bravo", "Charlie"]);
  });

  test("Move to another episode", async ({ page, world }) => {
    await chooseFromMenu(page, "Options for Bravo", "Move to…");
    await saves(page, () => page.locator("dialog[open] .move-option").filter({ hasText: "Third Act" }).click());
    await expect(page.locator(".editor-toast").filter({ hasText: "Moved to Episode 3" })).toBeVisible();

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(["Alpha", "Charlie"]);

    await open(page, `/episodes/${world.episodes[2].id}`);
    expect(await sceneOrder(page)).toEqual(["Bravo"]);
  });

  test("delete, then undo", async ({ page }) => {
    await chooseFromMenu(page, "Options for Bravo", "Delete");
    await saves(page, () => page.getByRole("button", { name: "Delete", exact: true }).click());
    await expect(sceneRow(page, "Bravo")).toHaveCount(0);

    await saves(page, () => page.getByRole("button", { name: "Undo" }).click());

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(STARTING_ORDER);
  });

  test("delete, then restore from Recently deleted", async ({ page, world }) => {
    await chooseFromMenu(page, "Options for Bravo", "Delete");
    await saves(page, () => page.getByRole("button", { name: "Delete", exact: true }).click());

    await open(page, `/seasons/${world.seasonId}`);
    await chooseFromMenu(page, "Season menu", "Recently deleted");
    await saves(page, () => page.getByRole("button", { name: "Restore Bravo" }).click());
    await expect(page.getByText("Nothing here.")).toBeVisible();

    await open(page, `/episodes/${world.episodes[0].id}`);
    expect(await sceneOrder(page)).toEqual(STARTING_ORDER);
  });

  test("reorder by drag", async ({ page }) => {
    const handle = await page.getByRole("button", { name: "Drag to reorder Alpha" }).boundingBox();
    const target = await sceneRow(page, "Charlie").boundingBox();

    await saves(page, () =>
      dragBetween(
        page,
        { x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2 },
        { x: target!.x + target!.width / 2, y: target!.y + target!.height / 2 },
      ),
    );

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(["Bravo", "Charlie", "Alpha"]);
  });

  test("undo a reorder", async ({ page }) => {
    await saves(page, () => page.getByRole("button", { name: "Move Alpha down" }).click());
    await saves(page, () => page.getByRole("button", { name: "Undo" }).click());

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(STARTING_ORDER);
  });

  test("move up and down with the keyboard, keeping focus", async ({ page }) => {
    const down = page.getByRole("button", { name: "Move Alpha down" });
    await down.focus();
    await saves(page, () => page.keyboard.press("Enter"));
    await expect(down).toBeFocused();
    await saves(page, () => page.keyboard.press("Enter"));
    await expect(down).toBeFocused();
    expect(await sceneOrder(page)).toEqual(["Bravo", "Charlie", "Alpha"]);

    const up = page.getByRole("button", { name: "Move Alpha up" });
    await up.focus();
    await saves(page, () => page.keyboard.press("Enter"));

    await reopen(page);
    expect(await sceneOrder(page)).toEqual(["Bravo", "Alpha", "Charlie"]);
  });

  test("status change and settings", async ({ page }) => {
    await saves(page, () => page.getByLabel("Status of Episode 1").selectOption("done"));
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByLabel("Summary").fill("Written on the episode page");
    await saves(page, () => page.getByRole("button", { name: "Save settings" }).click());

    await reopen(page);
    await expect(page.getByLabel("Status of Episode 1")).toHaveValue("done");
    await expect(page.getByText("Written on the episode page")).toBeVisible();
  });

  test("the whole card opens the scene", async ({ page }) => {
    await sceneRow(page, "Alpha").locator(".scene-card").click({ position: { x: 300, y: 30 } });
    await expect(page).toHaveURL(/\/scenes\//);
  });
});
