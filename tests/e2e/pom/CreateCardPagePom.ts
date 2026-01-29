import { expect, type Locator, type Page } from "@playwright/test";

export class CreateCardPagePom {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get root(): Locator {
    return this.page.getByTestId("create-card-page");
  }

  get heading(): Locator {
    return this.page.getByTestId("create-card-heading");
  }

  get card(): Locator {
    return this.page.getByTestId("create-card-card");
  }

  get errorAlert(): Locator {
    return this.page.getByTestId("create-card-error");
  }

  get form(): Locator {
    return this.page.getByTestId("card-form");
  }

  get frontInput(): Locator {
    return this.page.getByTestId("card-form-front");
  }

  get backTextarea(): Locator {
    return this.page.getByTestId("card-form-back");
  }

  get cancelButton(): Locator {
    return this.page.getByTestId("card-form-cancel");
  }

  get submitButton(): Locator {
    return this.page.getByTestId("card-form-submit");
  }

  async goto(): Promise<void> {
    await this.page.goto("/cards/new");
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.heading).toBeVisible();
    await expect(this.form).toBeVisible();
  }

  async fillFront(value: string): Promise<void> {
    await this.frontInput.fill(value);
  }

  async fillBack(value: string): Promise<void> {
    await this.backTextarea.fill(value);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
