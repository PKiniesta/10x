import { expect, test } from "@playwright/test";

import { HeaderPom } from "./pom/HeaderPom";
import { CreateCardPagePom } from "./pom/CreateCardPagePom";

const email = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const hasCreds = typeof email === "string" && email.length > 0 && typeof password === "string" && password.length > 0;

test.describe("manual card creation", () => {
  test.skip(!hasCreds, "E2E_USERNAME and E2E_PASSWORD must be set to run this test");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");

    const response = await page.request.post("/api/auth/login", {
      data: {
        email,
        password,
      },
    });

    expect(response.ok()).toBeTruthy();

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
