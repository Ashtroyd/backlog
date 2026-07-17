import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke against the real Supabase project. Each run creates one
 * throwaway user (claude-ci-…@gmail.com); purge them occasionally with:
 *   delete from auth.users where email like 'claude-%@gmail.com';
 */

test("landing explains the app and offers login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "mean to get to",
  );
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("signup → onboarding → add an anime → rate it", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/");

  // Sign up
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(`claude-ci-${stamp}@gmail.com`);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Sign up" }).click();

  // Onboarding
  await page.getByLabel("Display name").fill("CI Smoke");
  await page.getByLabel("Handle").fill(`ci${String(stamp).slice(-8)}`);
  await page.getByRole("button", { name: "Continue" }).click();
  // exact: true — "Games" otherwise substring-matches the empty state's
  // "No games yet" heading too, which a brand-new signup always shows.
  await expect(page.getByRole("heading", { name: "Games", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // Add an anime (Jikan needs no key, so this exercises real search)
  await page.getByRole("link", { name: "Anime" }).click();
  await page
    .getByRole("button", { name: /Add (your first )?anime/ })
    .first()
    .click();
  await page.getByPlaceholder("Search for an anime…").fill("frieren");
  const firstRow = page.locator('[role="dialog"] li').first();
  await firstRow.getByRole("button", { name: /Add/ }).click({ timeout: 20_000 });
  await expect(
    page.locator('[role="dialog"]').getByText("Added").first(),
  ).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Escape");

  // Complete it with a rating
  await page.locator('main .grid [role="button"]').first().click();
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Completed", exact: true })
    .click();
  await page.getByLabel("4 stars").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Rated 4 out of 5")).toBeVisible({
    timeout: 10_000,
  });
});
