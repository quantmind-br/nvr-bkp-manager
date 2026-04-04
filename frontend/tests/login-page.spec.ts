import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows login form elements", async ({ page }) => {
    await expect(page.locator("h1, h2, [class*='card-title']").first()).toBeVisible();
    await expect(page.locator("#login-username")).toBeVisible();
    await expect(page.locator("#login-password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await page.fill("#login-username", "wronguser");
    await page.fill("#login-password", "wrongpass");
    await page.click("button[type='submit']");
    await expect(
      page.locator("[role='alert'], [data-variant='destructive'], .text-destructive").first()
    ).toBeVisible({ timeout: 5000 });
  });
});
