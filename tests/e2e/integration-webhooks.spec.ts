import { test, expect } from "@playwright/test";

test.describe("Integration Webhooks", () => {
  test("should reject request with no signature header", async ({ page }) => {
    const response = await page.request.post(
      "http://localhost:3000/api/functions/v1/dropbox-sign/webhook",
      { data: { event: { event_type: "test" } } },
    );
    expect(response.status()).toBe(401);
  });

  test("should reject request with invalid signature", async ({ page }) => {
    const response = await page.request.post(
      "http://localhost:3000/api/functions/v1/checkr/webhook",
      {
        data: { type: "report.completed", data: {} },
        headers: { "X-Checkr-Signature": "invalid" },
      },
    );
    expect(response.status()).toBe(401);
  });
});
