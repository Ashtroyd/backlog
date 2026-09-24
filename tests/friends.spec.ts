import { test, expect } from "@playwright/test";
import {
  ACCOUNTS,
  SKIP_REASON,
  addFirstAnime,
  befriend,
  hasAccounts,
  twoFriendsToBe,
} from "./support/accounts";

/**
 * Social flow against the real Supabase project: the two reusable E2E
 * accounts (reset first, so they start as strangers) become friends and see
 * each other's library.
 */

test("two accounts become friends and see each other's library", async ({
  browser,
}) => {
  test.skip(!hasAccounts, SKIP_REASON);
  const { pageA, pageB, close } = await twoFriendsToBe(browser);
  await befriend(pageA, pageB);

  // A adds an anime and completes it with a rating (Jikan needs no key).
  const title = await addFirstAnime(pageA);
  await pageA.getByRole("button", { name: /^Open / }).first().click();
  await pageA
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Backlog", exact: true })
    .click();
  await pageA.getByRole("menuitemcheckbox", { name: "Completed" }).click();
  await pageA.getByLabel("4 stars").click();
  await expect(pageA.getByLabel("Rated 4 out of 5")).toBeVisible({
    timeout: 10_000,
  });

  // B revisits A's profile and sees it (RLS lets a friend read it now that
  // the request was accepted). The library opens on whichever section has
  // content — here, Anime.
  await pageB.goto(`/friends/${ACCOUNTS.a.handle}`);
  await expect(pageB.getByText(title, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });

  await close();
});
