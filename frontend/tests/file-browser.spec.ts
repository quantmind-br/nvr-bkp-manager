import { test, expect } from "@playwright/test";

// These tests require a running backend with valid credentials.
// Set TEST_USER and TEST_PASS environment variables to enable full testing.
// Will be expanded in T21 after UI migration is complete.
const TEST_USER = process.env.TEST_USER ?? "admin";
const TEST_PASS = process.env.TEST_PASS ?? "admin";

async function login(page: Parameters<typeof test>[1]["page"]) {
  await page.goto("/");
  await page.fill("#login-username", TEST_USER);
  await page.fill("#login-password", TEST_PASS);
  await page.click("button[type='submit']");
  await page
    .waitForSelector("table, [data-testid='file-browser']", { timeout: 10000 })
    .catch(() => {});
}

test.describe("File Browser", () => {
  test("shows file table after login", async ({ page }) => {
    await login(page);
    await expect(
      page.locator("table, [data-testid='file-browser']").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows breadcrumb path", async ({ page }) => {
    await login(page);
    await expect(
      page
        .locator("[aria-label*='breadcrumb'], [data-testid='breadcrumb'], nav[aria-label]")
        .first()
    ).toBeVisible({ timeout: 10000 });
  });
});
