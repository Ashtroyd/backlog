import { test, expect } from "@playwright/test";
import { ACCOUNTS, SKIP_REASON, addFirstAnime, hasAccounts, logIn, resetAccount } from "./support/accounts";

/**
 * End-to-end smoke against the real Supabase project, using the reusable
 * E2E account (see tests/support/accounts.ts) — nothing is signed up per run.
 */

test("landing explains the app and offers login", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "mean to get to",
  );
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("log in → welcome → add an anime → rate it", async ({ page }) => {
  test.skip(!hasAccounts, SKIP_REASON);
  await resetAccount(ACCOUNTS.a);
  await logIn(page, ACCOUNTS.a, { welcome: true });

  // A fresh browser sees the welcome sheet once.
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Add an anime (Jikan needs no key, so this exercises real search).
  await addFirstAnime(page);

  // Complete it with a rating.
  await page
    .getByRole("button", { name: /^Open / })
    .first()
    .click();
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Backlog", exact: true })
    .click();
  await page.getByRole("menuitemcheckbox", { name: "Completed" }).click();
  await page.getByLabel("4 stars").click();
  await expect(page.getByLabel("Rated 4 out of 5")).toBeVisible({
    timeout: 10_000,
  });
});
