import { test, expect } from "@playwright/test";
import { ACCOUNTS, SKIP_REASON, addFirstAnime, hasAccounts, logIn, resetAccount } from "./support/accounts";

/**
 * The "Continue" shelf on Up Next: a title marked in-progress should surface
 * there without any extra action. Uses the reusable E2E account.
 */

test("an in-progress title shows up under Continue on the homescreen", async ({
  page,
}) => {
  test.skip(!hasAccounts, SKIP_REASON);
  await resetAccount(ACCOUNTS.a);
  await logIn(page, ACCOUNTS.a);

  const title = await addFirstAnime(page);

  // Start it ("Watching" for anime) — one tap, saved immediately.
  await page
    .getByRole("button", { name: /^Open / })
    .first()
    .click();
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Start Watching" })
    .click();
  await expect(
    page.locator('[role="dialog"]').getByRole("button", { name: "Watching", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // It should now appear under Continue on Up Next.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Continue" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(title, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
});
