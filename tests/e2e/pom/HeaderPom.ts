import { type Locator, type Page } from "@playwright/test";

export class HeaderPom {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get root(): Locator {
    return this.page.getByTestId("header");
  }

  get generateManualLink(): Locator {
    return this.page.getByTestId("header-link-generate-manual");
  }

  get loginLink(): Locator {
    return this.page.getByTestId("login-link");
  }

  get registerLink(): Locator {
    return this.page.getByTestId("register-link");
  }

  get cardsListLink(): Locator {
    return this.page.getByTestId("header-link-cards-list");
  }

  get userEmail(): Locator {
    return this.page.getByTestId("header-user-email");
  }

  get logoutButton(): Locator {
    return this.page.getByTestId("logout-button");
  }

  async clickGenerateManual(): Promise<void> {
    await this.generateManualLink.click();
  }

  async clickLogin(): Promise<void> {
    await this.loginLink.click();
  }

  async clickRegister(): Promise<void> {
    await this.registerLink.click();
  }

  async clickCardsList(): Promise<void> {
    await this.cardsListLink.click();
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }
}
