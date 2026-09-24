import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end social flow against the real Supabase project: two throwaway
 * users become friends and see each other's library. Each run creates two
 * users (claude-ci-…-a@gmail.com / …-b@gmail.com); purge them occasionally:
 *   delete from auth.users where email like 'claude-%@gmail.com';
 */

async function signUp(
  page: Page,
  {
    email,
    displayName,
    handle,
  }: { email: string; displayName: string; handle: string },
) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("testpassword123");
  await page.getByRole("button", { name: "Sign up" }).click();

  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Handle").fill(handle);
  await page.getByRole("button", { name: "Continue" }).click();
  // Onboarding lands on the homescreen now, not /games — "CI" is the first
  // word of every display name passed in here, so this is deterministic.
  await expect(
    page.getByRole("heading", { name: "Up Next", level: 1 }),
  ).toBeVisible({
    timeout: 15_000,
  });
  // New accounts see the welcome sheet once.
  await page.getByRole("dialog").getByRole("button", { name: "Continue" }).click();
}

test("two accounts become friends and see each other's library", async ({
  browser,
}) => {
  const stamp = Date.now();
  const handleA = `cia${String(stamp).slice(-7)}`;
  const handleB = `cib${String(stamp).slice(-7)}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signUp(pageA, {
    email: `claude-ci-${stamp}-a@gmail.com`,
    displayName: "CI Friend A",
    handle: handleA,
  });
  await signUp(pageB, {
    email: `claude-ci-${stamp}-b@gmail.com`,
    displayName: "CI Friend B",
    handle: handleB,
  });

  // B sends A a friend request from A's profile page.
  await pageB.goto(`/friends/${handleA}`);
  await expect(pageB.getByRole("heading", { name: "CI Friend A" })).toBeVisible(
    { timeout: 10_000 },
  );
  await pageB.getByRole("button", { name: "Add friend" }).click();
  await expect(
    pageB.getByRole("button", { name: "Requested · Cancel" }),
  ).toBeVisible({ timeout: 10_000 });

  // A accepts from B's profile page.
  await pageA.goto(`/friends/${handleB}`);
  await expect(
    pageA.getByRole("button", { name: "Accept request" }),
  ).toBeVisible({ timeout: 10_000 });
  await pageA.getByRole("button", { name: "Accept request" }).click();
  await expect(pageA.getByRole("button", { name: "Friends ✓" })).toBeVisible({
    timeout: 10_000,
  });

  // A adds an anime and completes it with a rating (Jikan needs no key).
  await pageA.getByRole("link", { name: "Anime" }).click();
  await pageA
    .getByRole("button", { name: /Add (your first )?anime/ })
    .first()
    .click();
  await pageA.getByPlaceholder("Search for an anime…").fill("frieren");
  const firstRow = pageA.locator('[role="dialog"] li').first();
  await firstRow
    .getByRole("button", { name: /Add/ })
    .click({ timeout: 20_000 });
  await expect(
    pageA.locator('[role="dialog"]').getByText("Added").first(),
  ).toBeVisible({
    timeout: 20_000,
  });
  await pageA.keyboard.press("Escape");

  const firstCard = pageA.getByRole("button", { name: /^Open / }).first();
  const title = (await firstCard.locator("p").first().textContent())?.trim();
  expect(title).toBeTruthy();

  await firstCard.click();
  await pageA
    .locator('[role="dialog"]')
    .getByRole("button", { name: "Backlog", exact: true })
    .click();
  await pageA.getByRole("menuitemcheckbox", { name: "Completed" }).click();
  await pageA.getByLabel("4 stars").click();
  await expect(pageA.getByLabel("Rated 4 out of 5")).toBeVisible({
    timeout: 10_000,
  });

  // B revisits A's profile and sees the newly-completed title (RLS lets a
  // friend read it now that the request was accepted). The library defaults
  // to whichever section actually has content — here, Anime.
  await pageB.goto(`/friends/${handleA}`);
  await expect(pageB.getByText(title!, { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });

  await contextA.close();
  await contextB.close();
});
