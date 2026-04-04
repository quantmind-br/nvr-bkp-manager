import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows login form elements", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible();
    await expect(page.locator("#login-username, input[type='text']").first()).toBeVisible();
    await expect(page.locator("#login-password, input[type='password']").first()).toBeVisible();
    await expect(page.locator("button[type='submit']").first()).toBeVisible();
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await page.fill("#login-username", "wronguser");
    await page.fill("#login-password", "wrongpass");
    await page.click("button[type='submit']");
    await expect(
      page.locator("[role='alert'], .text-destructive, p[style*='color']").first()
    ).toBeVisible({ timeout: 5000 });
  });
});
