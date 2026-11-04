import {
  chooseFromMenu,
  dragBetween,
  episodeCard,
  episodeOrder,
  expect,
  open,
  reopen,
  saves,
  test,
} from "./support";

const SEASON_STATUSES = { open: "1:Opening Night", second: "2:Second Act", third: "3:Third Act" };

test.describe("season page", () => {
  test.beforeEach(async ({ page, world }) => {
    await open(page, `/seasons/${world.seasonId}`);
  });

  test("the options menu opens styled, in the body", async ({ page }) => {
    await episodeCard(page, "Second Act").hover();
    await page.getByRole("button", { name: "Options for Episode 2", exact: true }).click();

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem")).toHaveText(["Rename and settings", "Mark done", "Move up", "Move down", "Delete"]);

    const look = await menu.evaluate((element) => {
      const style = getComputedStyle(element);
      return { parent: element.parentElement?.tagName, position: style.position, radius: style.borderRadius };
    });
    expect(look).toEqual({ parent: "BODY", position: "fixed", radius: "12px" });

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("create an episode", async ({ page }) => {
    await page.getByRole("button", { name: "New episode" }).click();
    await page.getByLabel("Title").fill("Created Here");
    await saves(page, () => page.getByRole("button", { name: "Create episode" }).click());

    await reopen(page);
    expect(await episodeOrder(page)).toContain("4:Created Here");
  });

  test("a taken number is refused with a message", async ({ page }) => {
    await page.getByRole("button", { name: "New episode" }).click();
    await page.getByLabel("Number").fill("2");
    await page.getByLabel("Title").fill("Clash");
    await page.getByRole("button", { name: "Create episode" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Episode 2 already exists" })).toBeVisible();
  });

  test("rename and settings", async ({ page }) => {
    await episodeCard(page, "Second Act").hover();
    await chooseFromMenu(page, "Options for Episode 2", "Rename and settings");
    await page.getByLabel("Title", { exact: true }).fill("Renamed Act");
    await page.getByLabel("Summary").fill("A new summary");
    await page.getByLabel(/Opening theme/).fill("Opening Song");
    await saves(page, () => page.getByRole("button", { name: "Save settings" }).click());

    await reopen(page);
    await expect(episodeCard(page, "Renamed Act")).toContainText("A new summary");
  });

  test("status change on the card", async ({ page }) => {
    await saves(page, () => page.getByLabel("Status of Episode 1").selectOption("idea"));

    await reopen(page);
    await expect(page.getByLabel("Status of Episode 1")).toHaveValue("idea");
  });

  test("mark done from the menu", async ({ page }) => {
    await episodeCard(page, "Second Act").hover();
    await saves(page, () => chooseFromMenu(page, "Options for Episode 2", "Mark done"));

    await reopen(page);
    await expect(page.getByLabel("Status of Episode 2")).toHaveValue("done");
  });

  test("mark done and continue, from the header", async ({ page }) => {
    await saves(page, () => page.getByRole("button", { name: "Mark Episode 1 done" }).click());

    const next = page.getByRole("link", { name: "Continue Episode 2" });
    await expect(next).toBeVisible();
    await next.click();
    await expect(page).toHaveURL(/\/episodes\//);
  });

  test("delete, then undo", async ({ page }) => {
    await episodeCard(page, "Second Act").hover();
    await chooseFromMenu(page, "Options for Episode 2", "Delete");
    await saves(page, () => page.getByRole("button", { name: "Delete", exact: true }).click());
    await expect(episodeCard(page, "Second Act")).toHaveCount(0);

    await saves(page, () => page.getByRole("button", { name: "Undo" }).click());

    await reopen(page);
    expect(await episodeOrder(page)).toContain(SEASON_STATUSES.second);
  });

  test("delete, then restore from Recently deleted", async ({ page }) => {
    await episodeCard(page, "Third Act").hover();
    await chooseFromMenu(page, "Options for Episode 3", "Delete");
    await saves(page, () => page.getByRole("button", { name: "Delete", exact: true }).click());

    await reopen(page);
    expect(await episodeOrder(page)).not.toContain(SEASON_STATUSES.third);

    await chooseFromMenu(page, "Season menu", "Recently deleted");
    await saves(page, () => page.getByRole("button", { name: /^Restore Episode 3/ }).click());
    await expect(page.getByText("Nothing here.")).toBeVisible();

    await reopen(page);
    expect(await episodeOrder(page)).toContain(SEASON_STATUSES.third);
  });

  test("reorder by drag, then undo", async ({ page }) => {
    await episodeCard(page, "Opening Night").hover();
    const handle = await page.getByRole("button", { name: "Drag to reorder Episode 1" }).boundingBox();
    const target = await episodeCard(page, "Third Act").boundingBox();

    await saves(page, () =>
      dragBetween(
        page,
        { x: handle!.x + 16, y: handle!.y + 16 },
        { x: target!.x + target!.width / 2, y: target!.y + target!.height / 2 },
      ),
    );

    await reopen(page);
    expect(await episodeOrder(page)).toEqual(["1:Second Act", "2:Third Act", "3:Opening Night"]);
  });

  test("undo a reorder", async ({ page }) => {
    await episodeCard(page, "Opening Night").hover();
    await saves(page, () => chooseFromMenu(page, "Options for Episode 1", "Move down"));
    await saves(page, () => page.getByRole("button", { name: "Undo" }).click());

    await reopen(page);
    expect(await episodeOrder(page)).toEqual(Object.values(SEASON_STATUSES));
  });

  test("move up and down from the menu, keeping focus", async ({ page }) => {
    await episodeCard(page, "Second Act").hover();
    await saves(page, () => chooseFromMenu(page, "Options for Episode 2", "Move down"));
    await expect(page.getByRole("button", { name: "Options for Episode 3", exact: true })).toBeFocused();

    await saves(page, () => chooseFromMenu(page, "Options for Episode 3", "Move up"));
    await expect(page.getByRole("button", { name: "Options for Episode 2", exact: true })).toBeFocused();

    await reopen(page);
    expect(await episodeOrder(page)).toEqual(Object.values(SEASON_STATUSES));
  });

  test("season settings", async ({ page }) => {
    await chooseFromMenu(page, "Season menu", "Season settings");
    await page.getByLabel("Summary").fill("A season summary");
    await saves(page, () => page.getByRole("button", { name: "Save settings" }).click());

    await reopen(page);
    await expect(page.getByText("A season summary")).toBeVisible();
  });

  test("the conflict message, when someone changed it first", async ({ page, context, world }) => {
    const other = await context.newPage();
    await open(other, `/seasons/${world.seasonId}`);
    await saves(other, () => other.getByLabel("Status of Episode 1").selectOption("idea"));
    await other.close();

    await page.getByLabel("Status of Episode 1").selectOption("done");
    const alert = page.getByRole("alertdialog");
    await expect(alert).toContainText("Someone else edited this episode");

    await alert.getByRole("button", { name: "Reload their version" }).click();
    await expect(page.getByLabel("Status of Episode 1")).toHaveValue("idea");
  });

  test("the phone menu is a bottom sheet that still works", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByRole("button", { name: "Options for Episode 2", exact: true }).click();

    const sheet = page.getByRole("menu");
    await expect(sheet).toHaveAttribute("data-sheet");

    await saves(page, () => page.getByRole("menuitem", { name: "Mark done" }).click());
    await expect(page.getByLabel("Status of Episode 2")).toHaveValue("done");
  });
});
