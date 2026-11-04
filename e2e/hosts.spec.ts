import { networkInterfaces } from "node:os";
import { chooseFromMenu, expect, open, saves, signInCookie, test } from "./support";

const lanAddress = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === "IPv4" && !address.internal)?.address;

/**
 * The cards are drawn by the server, so a page whose JavaScript never started
 * still looks right while every button does nothing. This opens the site the
 * other ways a person might, and proves a real action works on each.
 */
for (const host of ["127.0.0.1", lanAddress].filter(Boolean)) {
  test(`the page comes alive at ${host}`, async ({ browser, baseURL, world }) => {
    const url = new URL(baseURL!);
    test.skip(url.hostname !== "localhost", "Only runs when the suite targets localhost");
    url.hostname = host!;

    const context = await browser.newContext({ baseURL: url.origin, viewport: { width: 1280, height: 900 } });
    await context.addCookies([await signInCookie(url.origin)]);
    const page = await context.newPage();

    await open(page, `/seasons/${world.seasonId}`);
    await page.locator(".sort-row").first().hover();
    await saves(page, () => chooseFromMenu(page, "Options for Episode 1", "Mark done"));
    await expect(page.getByLabel("Status of Episode 1")).toHaveValue("done");

    await context.close();
  });
}
