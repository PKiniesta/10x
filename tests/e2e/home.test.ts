import { test, expect } from "@playwright/test";

test("homepage has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  // Note: Update this to match your actual page title or content
  await expect(page).toHaveTitle(/Fiszki/i);
});
