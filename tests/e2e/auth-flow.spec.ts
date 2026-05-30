import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should render login page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/BlockLabor/);
  });
});
