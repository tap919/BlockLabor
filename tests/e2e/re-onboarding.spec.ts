import { test, expect } from "@playwright/test";

test.describe("Worker Re-onboarding", () => {
  test("should display services page", async ({ page }) => {
    await page.goto("/services");
    await expect(page.locator("h1")).toContainText(/Service/);
  });
});
