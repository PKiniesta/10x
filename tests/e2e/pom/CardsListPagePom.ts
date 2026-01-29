import { expect, type Locator, type Page } from "@playwright/test";

export class CardsListPagePom {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get root(): Locator {
    return this.page.getByTestId("cards-list-page");
  }

  get loadingIndicator(): Locator {
    return this.page.getByTestId("cards-loading");
  }

  get unauthorizedMessage(): Locator {
    return this.page.getByTestId("cards-unauthorized");
  }

  get loginButton(): Locator {
    return this.page.getByTestId("cards-login-button");
  }

  get emptyState(): Locator {
    return this.page.getByTestId("cards-empty");
  }

  get errorAlert(): Locator {
    return this.page.getByTestId("cards-error");
  }

  async goto(): Promise<void> {
    await this.page.goto("/cards");
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.loadingIndicator).not.toBeVisible();
  }
}
