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
 * The two friend-scoped RLS features: a monthly Top Picks shelf becoming
 * friend-visible, and a Shared Backlog entry showing up for both
 * participants. Uses the two reusable E2E accounts, reset first.
 */

test("a friend's top picks and a shared-backlog entry are both visible to them", async ({ browser }) => {
  test.skip(!hasAccounts, SKIP_REASON);
  const { pageA, pageB, close } = await twoFriendsToBe(browser);
  await befriend(pageA, pageB);

  // --- Top Picks: A adds an anime to their own library, then features it. ---
  const title = await addFirstAnime(pageA);

  await pageA.goto("/");
  await pageA.getByRole("button", { name: /Choose up to 5 favourites/ }).click();
  const pickerDialog = pageA.locator('[role="dialog"]');
  await pickerDialog.locator("li").first().getByRole("button", { name: "Choose" }).click();
  await pickerDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pageA.getByText("Top picks updated.")).toBeVisible({ timeout: 10_000 });

  // B sees the pick on A's profile, and under Top Picks on their own homescreen.
  await pageB.goto(`/friends/${ACCOUNTS.a.handle}`);
  await expect(pageB.getByRole("heading", { name: "Top picks" })).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

  await pageB.goto("/");
  await expect(pageB.getByRole("link", { name: new RegExp(ACCOUNTS.a.name) })).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

  // --- Shared Backlog: A plans a title with B. ---
  await pageA.goto("/shared");
  await pageA.getByRole("button", { name: "Add to shared backlog" }).click();
  const sharedDialog = pageA.locator('[role="dialog"]');
  await sharedDialog.getByRole("button", { name: "Anime", exact: true }).click();
  await pageA.getByPlaceholder("Search for an anime…").fill("frieren");
  const pickRow = sharedDialog.locator("li").first();
  const sharedTitle = (await pickRow.locator("p").first().textContent())?.trim();
  expect(sharedTitle).toBeTruthy();
  await pickRow.getByRole("button", { name: "Pick" }).click();
  await sharedDialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(sharedDialog.getByRole("button", { name: "Added" })).toBeVisible({ timeout: 10_000 });

  // B sees the joint entry on their own Shared Backlog page, credited to A.
  await pageB.goto("/shared");
  await expect(pageB.getByText(sharedTitle!, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(pageB.getByText(ACCOUNTS.a.name, { exact: false }).first()).toBeVisible();

  await close();
});
