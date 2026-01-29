import { test as setup } from "@playwright/test";
import path from "node:path";

import { LoginPagePom } from "./pom/LoginPagePom";

const authFile = path.join(import.meta.dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error("E2E_USERNAME and E2E_PASSWORD must be set");
  }

  const loginPage = new LoginPagePom(page);
  await loginPage.goto();
  await page.waitForLoadState("networkidle");

  await loginPage.root.waitFor({ state: "visible" });

  await loginPage.emailInput.click();
  await loginPage.emailInput.clear();
  await loginPage.emailInput.pressSequentially(email, { delay: 50 });

  await loginPage.passwordInput.click();
  await loginPage.passwordInput.clear();
  await loginPage.passwordInput.pressSequentially(password, { delay: 50 });

  await loginPage.submitButton.click();

  await page.waitForTimeout(2000);

  const errorVisible = await loginPage.errorMessage.isVisible().catch(() => false);
  if (errorVisible) {
    const errorText = await loginPage.errorMessage.textContent();
    throw new Error(`Login failed: ${errorText}`);
  }

  const currentUrl = page.url();
  if (!currentUrl.includes("/cards")) {
    await page.screenshot({ path: "tests/e2e/debug-login.png" });
    throw new Error(`Expected redirect to /cards but got: ${currentUrl}. Screenshot saved.`);
  }

  await page.context().storageState({ path: authFile });
});
