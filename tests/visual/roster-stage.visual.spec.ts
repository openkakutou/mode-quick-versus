import { waitForVisualReady } from "@openkakutou/web-ui-kit/testing/visual-preset";
import { expect, test } from "@playwright/test";

/**
 * Baseline screenshots of this app's real rendered selection screens
 * (backlog item 011): the roster grid with a real character picked per
 * player, and the stage grid with a stage selected. Driven through the
 * app's own real click interactions against real, committed fixture
 * character/stage data (`tests/visual/fixtures/`, see its README and
 * `.vibe/decisions/008`) — the actual `character`/`stage` WASM bridges
 * parse this data for real, the same way the production app does.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("roster grid with a character picked for each player matches its baseline", async ({
  page,
}) => {
  const grid = page.locator(".roster-screen__grid");
  await expect(grid).toBeVisible();

  const cards = grid.locator(".roster-screen__card");
  await expect(cards).toHaveCount(2);

  await cards.nth(0).locator(".roster-screen__pick--p1").click();
  await cards.nth(1).locator(".roster-screen__pick--p2").click();

  await expect(cards.nth(0).locator(".roster-screen__pick--p1")).toHaveText(
    /✓/,
  );
  await expect(cards.nth(1).locator(".roster-screen__pick--p2")).toHaveText(
    /✓/,
  );

  await waitForVisualReady(page);
  // Screenshotted per-card, not as one whole-grid image: a regression
  // confined to a single card's pick button (the kind this suite's own
  // deliberate-regression check exercises) would otherwise be too small a
  // fraction of a large multi-card composite to cross the shared default
  // `maxDiffPixelRatio` — confirmed for real while proving this suite
  // actually catches a regression (see `.vibe/decisions/008`).
  await expect(cards.nth(0)).toHaveScreenshot("roster-card-player1-picked.png");
  await expect(cards.nth(1)).toHaveScreenshot("roster-card-player2-picked.png");
});

test("stage grid with a stage selected matches its baseline", async ({
  page,
}) => {
  const rosterGrid = page.locator(".roster-screen__grid");
  const cards = rosterGrid.locator(".roster-screen__card");
  await cards.nth(0).locator(".roster-screen__pick--p1").click();
  await cards.nth(0).locator(".roster-screen__pick--p2").click();
  await page
    .locator(".roster-screen wuik-button", { hasText: "Continue" })
    .click();

  const stageGrid = page.locator(".stage-screen__grid");
  await expect(stageGrid).toBeVisible();

  const stageCard = stageGrid.locator(".stage-screen__card");
  await expect(stageCard).toHaveCount(1);
  await stageCard.locator(".stage-screen__select").click();
  await expect(stageCard.locator(".stage-screen__select")).toHaveText(/✓/);

  await waitForVisualReady(page);
  await expect(stageGrid).toHaveScreenshot("stage-grid-selected.png");
});
