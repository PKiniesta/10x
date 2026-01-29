import { expect, type Locator, type Page } from "@playwright/test";

export class LoginPagePom {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get root(): Locator {
    return this.page.getByTestId("login-card");
  }

  get emailInput(): Locator {
    return this.page.getByTestId("login-email-input");
  }

  get passwordInput(): Locator {
    return this.page.getByTestId("login-password-input");
  }

  get submitButton(): Locator {
    return this.page.getByTestId("login-submit-button");
  }

  get errorMessage(): Locator {
    return this.page.getByTestId("login-error-message");
  }

  get forgotPasswordLink(): Locator {
    return this.page.getByTestId("forgot-password-link");
  }

  get registerLink(): Locator {
    return this.page.getByTestId("register-link");
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message?: string): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.errorMessage).toContainText(message);
    }
  }

  async clickRegister(): Promise<void> {
    await this.registerLink.click();
  }

  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
  }
}
