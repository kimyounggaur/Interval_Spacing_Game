import assert from "node:assert/strict";

const open = async (page) => {
  await page.locator("[data-rulebook-open]:visible").first().click();
  await page.locator(".rulebook[open]").waitFor();
};
const close = async (page) => {
  await page.locator(".rulebook [data-rulebook-close]:visible").first().click();
  await page.locator(".rulebook[open]").waitFor({ state: "hidden" });
};

/** The original game runner provides an isolated save and context per case. */
export const rulebookScenarios = {
  "BOOK-01": async ({ page }) => {
    const opener = page.locator("[data-rulebook-open]:visible").first();
    assert.ok(await opener.isVisible(), "rulebook opens from the title header");
    await open(page);
    const book = page.locator(".rulebook[open]");
    assert.equal(await book.getAttribute("aria-labelledby"), "rulebook-title");
    assert.ok((await book.locator(".rulebook-nav a").count()) >= 6, "chapter navigation");
    assert.ok((await book.locator(".rulebook-section").count()) >= 6, "complete chapter content");
    assert.ok(
      (await book.locator(".rulebook-figure .rulebook-art svg").count()) >= 10,
      "illustrations",
    );
    assert.ok((await book.locator(".rulebook-cover-art").count()) >= 1, "illustrated cover");
    await book.locator('.rulebook-nav a[href="#rb-routes"]').click();
    assert.ok(await book.locator("#rb-routes").isVisible(), "route chapter is reachable");
    await close(page);
    assert.ok(
      await opener.evaluate((el) => document.activeElement === el),
      "focus returns to opener",
    );
  },
  "BOOK-02": async ({ page }) => {
    await page.locator('[data-action="routes"]:visible').first().click();
    await page.locator('[data-action="start-intro"]:visible').first().click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("ijs_save_v3") || "null")?.activeRun?.checkpoint,
    );
    const position = await page.evaluate(
      () => JSON.parse(localStorage.getItem("ijs_save_v3")).activeRun.pos,
    );
    await page.locator('#controls [data-control="2"]').click();
    await page.waitForFunction(
      (previous) =>
        JSON.parse(localStorage.getItem("ijs_save_v3") || "null")?.activeRun?.pos !== previous,
      position,
    );
    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem("ijs_save_v3")).activeRun,
    );
    const title = await page.locator("#ticket-title").textContent();
    const hud = await page.locator("#hud-dots").getAttribute("aria-label");
    await open(page);
    await page.keyboard.press("Escape");
    await page.locator(".rulebook[open]").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#screen").getAttribute("data-screen"), "run");
    assert.equal(await page.locator("#ticket-title").textContent(), title);
    assert.equal(await page.locator("#hud-dots").getAttribute("aria-label"), hud);
    assert.deepEqual(
      await page.evaluate(() => JSON.parse(localStorage.getItem("ijs_save_v3")).activeRun),
      before,
      "reading preserves current run",
    );
    assert.ok(
      await page
        .locator("#run [data-rulebook-open]")
        .evaluate((el) => document.activeElement === el),
      "Escape restores focus to run header",
    );
    assert.ok(
      await page.locator('#controls [data-control="2"]').isEnabled(),
      "game remains playable",
    );
  },
  "BOOK-03": async ({ page }) => {
    for (const [width, height] of [
      [320, 568],
      [390, 664],
    ]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "130%";
      });
      await open(page);
      const book = page.locator(".rulebook[open]");
      const bounds = await book.evaluate((dialog) => {
        const r = dialog.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          scroll: dialog.scrollWidth,
          width: dialog.clientWidth,
        };
      });
      assert.ok(
        bounds.left >= -1 &&
          bounds.top >= -1 &&
          bounds.right <= width + 1 &&
          bounds.bottom <= height + 1,
        JSON.stringify(bounds),
      );
      assert.ok(
        bounds.scroll <= bounds.width + 1,
        `rulebook horizontal overflow: ${JSON.stringify(bounds)}`,
      );
      const art = await book.locator(".rulebook-figure .rulebook-art svg").evaluateAll((items) =>
        items.map((item) => {
          const r = item.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }),
      );
      assert.ok(
        art.length >= 10 && art.every((r) => r.width > 30 && r.height > 30 && r.width <= width),
        JSON.stringify(art),
      );
      await close(page);
    }
  },
};
