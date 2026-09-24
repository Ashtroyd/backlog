import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end coverage for the two friend-scoped RLS features added this
 * session: a monthly Top Picks shelf becoming friend-visible, and a Shared
 * Backlog entry showing up for both participants. One friend pair covers
 * both, to avoid spinning up a throwaway account per feature. Purge
 * occasionally: delete from auth.users where email like 'claude-%@gmail.com';
 */

async function signUp(
  page: Page,
  { email, displayName, handle }: { email: string; displayName: string; handle: string },
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Handle").fill(handle);
  await page.getByRole("button", { name: "Continue" }).click();
  // "CI" is the first word of every display name passed in here, so this is
  // deterministic regardless of which test is running.
  await expect(page.getByRole("heading", { name: "Up Next", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  // New accounts see the welcome sheet once.
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
}

test("a friend's top picks and a shared-backlog entry are both visible to them", async ({ browser }) => {
  const stamp = Date.now();
  const handleA = `sfa${String(stamp).slice(-7)}`;
  const handleB = `sfb${String(stamp).slice(-7)}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signUp(pageA, {
    email: `claude-ci-${stamp}-a@gmail.com`,
    displayName: "CI Shared A",
    handle: handleA,
  });
  await signUp(pageB, {
    email: `claude-ci-${stamp}-b@gmail.com`,
    displayName: "CI Shared B",
    handle: handleB,
  });

  // B sends A a friend request, A accepts — same flow as friends.spec.ts.
  await pageB.goto(`/friends/${handleA}`);
  await pageB.getByRole("button", { name: "Add friend" }).click();
  await expect(pageB.getByRole("button", { name: "Requested · Cancel" })).toBeVisible({
    timeout: 10_000,
  });
  await pageA.goto(`/friends/${handleB}`);
  await expect(pageA.getByRole("button", { name: "Accept request" })).toBeVisible({
    timeout: 10_000,
  });
  await pageA.getByRole("button", { name: "Accept request" }).click();
  await expect(pageA.getByRole("button", { name: "Friends ✓" })).toBeVisible({ timeout: 10_000 });

  // --- Top Picks: A adds an anime to their own library, then features it. ---
  await pageA.getByRole("link", { name: "Anime" }).click();
  await pageA
    .getByRole("button", { name: /Add (your first )?anime/ })
    .first()
    .click();
  await pageA.getByPlaceholder("Search for an anime…").fill("frieren");
  const addRow = pageA.locator('[role="dialog"] li').first();
  await addRow.getByRole("button", { name: /Add/ }).click({ timeout: 20_000 });
  await expect(pageA.locator('[role="dialog"]').getByText("Added").first()).toBeVisible({
    timeout: 20_000,
  });
  const title = (await addRow.locator("p").first().textContent())?.trim();
  expect(title).toBeTruthy();
  await pageA.keyboard.press("Escape");

  await pageA.goto("/");
  await pageA.getByRole("button", { name: /Choose up to 5 favourites/ }).click();
  const pickerDialog = pageA.locator('[role="dialog"]');
  await pickerDialog.locator("li").first().getByRole("button", { name: "Choose" }).click();
  await pickerDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(pageA.getByText("Top picks updated.")).toBeVisible({ timeout: 10_000 });

  // B sees the pick on A's profile, and under Top Picks on their own homescreen.
  await pageB.goto(`/friends/${handleA}`);
  await expect(pageB.getByRole("heading", { name: "Top picks" })).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText(title!, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

  await pageB.goto("/");
  await expect(pageB.getByRole("link", { name: /CI Shared A/ })).toBeVisible({ timeout: 10_000 });
  await expect(pageB.getByText(title!, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

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
  await expect(pageB.getByText("CI Shared A", { exact: false }).first()).toBeVisible();

  await contextA.close();
  await contextB.close();
});
