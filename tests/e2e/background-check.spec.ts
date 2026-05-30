import { test, expect } from "@playwright/test";

test.describe("Background Check Flow", () => {
  test("should display candidates page", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page.locator("h1")).toContainText(/Candidate/);
  });
});
