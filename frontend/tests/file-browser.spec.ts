import { test, expect } from "@playwright/test";

const TEST_USER = process.env.TEST_USER ?? "admin";
const TEST_PASS = process.env.TEST_PASS ?? "admin";

async function login(page: Parameters<typeof test>[1]["page"]) {
  await page.goto("/");
  await page.fill("#login-username", TEST_USER);
  await page.fill("#login-password", TEST_PASS);
  await page.click("button[type='submit']");
  await page.waitForSelector("table", { timeout: 10000 }).catch(() => {});
}

test.describe("File Browser", () => {
  test("shows file table after login", async ({ page }) => {
    await login(page);
    await expect(page.locator("table").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows breadcrumb navigation", async ({ page }) => {
    await login(page);
    await expect(
      page.locator("nav[aria-label='breadcrumb'], [data-slot='breadcrumb']").first()
    ).toBeVisible({ timeout: 10000 });
  });
});
