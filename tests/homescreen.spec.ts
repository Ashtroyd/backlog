import { test, expect } from "@playwright/test";

/**
 * End-to-end check for the "Continue" homescreen shelf: a title marked
 * in-progress should surface there without any extra action. Each run
 * creates one throwaway user (claude-ci-…@gmail.com); purge occasionally:
 *   delete from auth.users where email like 'claude-%@gmail.com';
 */

test("an in-progress title shows up under Continue on the homescreen", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");

  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(`claude-ci-${stamp}@gmail.com`);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.getByLabel("Display name").fill("CI Continue");
  await page.getByLabel("Handle").fill(`cic${String(stamp).slice(-8)}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back, CI" })).toBeVisible({
    timeout: 15_000,
  });

  // Add an anime (Jikan needs no key, so this exercises real search).
  await page.getByRole("link", { name: "Anime" }).click();
  await page
    .getByRole("button", { name: /Add (your first )?anime/ })
    .first()
    .click();
  await page.getByPlaceholder("Search for an anime…").fill("frieren");
  const firstRow = page.locator('[role="dialog"] li').first();
  await firstRow.getByRole("button", { name: /Add/ }).click({ timeout: 20_000 });
  await expect(page.locator('[role="dialog"]').getByText("Added").first()).toBeVisible({
    timeout: 20_000,
  });
  const title = (await firstRow.locator("p").first().textContent())?.trim();
  expect(title).toBeTruthy();
  await page.keyboard.press("Escape");

  // Mark it in-progress ("Watching" for anime) and save.
  await page.locator('main .grid [role="button"]').first().click();
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Watching", exact: true })
    .click();
  await page.locator('[role="dialog"]').getByRole("button", { name: "Save", exact: true }).click();
  await page.keyboard.press("Escape");

  // It should now appear under Continue on the homescreen.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Continue" })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(title!, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
});
