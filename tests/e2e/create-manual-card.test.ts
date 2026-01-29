import { expect, test } from "@playwright/test";

import { HeaderPom } from "./pom/HeaderPom";
import { CreateCardPagePom } from "./pom/CreateCardPagePom";

test.describe("manual card creation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/cards");
  });

  test("creates a card from header > Generuj manualnie", async ({ page }) => {
    const header = new HeaderPom(page);

    await expect(header.root).toBeVisible();
    await expect(header.generateManualLink).toBeVisible();

    await header.clickGenerateManual();

    const createCardPage = new CreateCardPagePom(page);

    await createCardPage.waitForLoaded();

    await createCardPage.fillFront(`E2E front ${Date.now()}`);
    await createCardPage.fillBack(`E2E back ${Date.now()}`);

    await createCardPage.submit();

    await page.waitForURL("**/cards");
  });
});
