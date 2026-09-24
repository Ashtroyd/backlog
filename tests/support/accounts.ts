import { createClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Two reusable end-to-end accounts on the real Supabase project, instead of
 * signing up a throwaway user every run. They're "+" aliases of the owner's
 * address, so any mail Supabase sends is deliverable and nothing bounces.
 *
 * The password lives only in the environment: E2E_PASSWORD (a GitHub
 * Actions secret in CI; `.env.test.local` locally). Without it the
 * account-backed tests skip. The first run with it creates both accounts;
 * every run after reuses them, wiping their data first.
 */
export type Account = {
  key: "a" | "b";
  email: string;
  handle: string;
  name: string;
};

export const ACCOUNTS: Record<"a" | "b", Account> = {
  a: {
    key: "a",
    email: process.env.E2E_EMAIL_A ?? "johnlukebrooks80+backlog-e2e-a@gmail.com",
    handle: "e2e_alpha",
    name: "E2E Alpha",
  },
  b: {
    key: "b",
    email: process.env.E2E_EMAIL_B ?? "johnlukebrooks80+backlog-e2e-b@gmail.com",
    handle: "e2e_bravo",
    name: "E2E Bravo",
  },
};

const PASSWORD = process.env.E2E_PASSWORD ?? "";
export const SKIP_REASON = "Set E2E_PASSWORD to run the account-backed tests.";
export const hasAccounts = PASSWORD.length > 0;

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY aren't set.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function check(what: string, error: { message: string } | null) {
  if (error) throw new Error(`Resetting ${what}: ${error.message}`);
}

/**
 * Signs in as the account (creating it on the very first run), makes sure
 * its profile exists with default settings, and deletes everything it owns
 * or takes part in — items (and with them top picks, comments and their
 * notifications), friendships, shared-backlog rows, messages it sent and
 * notifications it received. Row-level security lets an owner do all of
 * this, so no service key is needed.
 */
export async function resetAccount(account: Account): Promise<string> {
  const sb = client();
  const signIn = await sb.auth.signInWithPassword({
    email: account.email,
    password: PASSWORD,
  });
  let user = signIn.data.user;
  if (signIn.error?.message === "Invalid login credentials") {
    const signUp = await sb.auth.signUp({ email: account.email, password: PASSWORD });
    if (signUp.error) {
      throw new Error(
        `Couldn't sign in or create ${account.email}: ${signUp.error.message}. ` +
          "If the account already exists, E2E_PASSWORD doesn't match it.",
      );
    }
    if (!signUp.data.session) {
      throw new Error(
        `${account.email} was created but needs email confirmation — click the ` +
          "link Supabase sent to that inbox once, then rerun.",
      );
    }
    user = signUp.data.user;
  } else if (signIn.error) {
    throw new Error(`Signing in ${account.email}: ${signIn.error.message}`);
  }
  if (!user) throw new Error(`Signing in ${account.email}: no user returned`);
  const id = user.id;

  check(
    "profile",
    (
      await sb.from("profiles").upsert({
        id,
        username: account.handle,
        display_name: account.name,
        bio: null,
        home_layout: null,
      })
    ).error,
  );
  check("items", (await sb.from("items").delete().eq("user_id", id)).error);
  check("top picks", (await sb.from("top_picks").delete().eq("user_id", id)).error);
  check(
    "friendships",
    (await sb.from("friendships").delete().or(`requester_id.eq.${id},addressee_id.eq.${id}`))
      .error,
  );
  check(
    "shared backlog",
    (await sb.from("shared_items").delete().or(`added_by.eq.${id},friend_id.eq.${id}`)).error,
  );
  check("messages", (await sb.from("messages").delete().eq("sender_id", id)).error);
  check(
    "notifications",
    (await sb.from("notifications").delete().eq("recipient_id", id)).error,
  );
  await sb.auth.signOut();
  return id;
}

/**
 * Logs in through the real login screen and waits for Up Next. The welcome
 * sheet shows once per browser; pass `welcome: true` to leave it up (a fresh
 * context would otherwise show it on every test).
 */
export async function logIn(
  page: Page,
  account: Account,
  { welcome = false }: { welcome?: boolean } = {},
) {
  if (!welcome) {
    await page.addInitScript(() => localStorage.setItem("backlog:tourSeen", "true"));
  }
  await page.goto("/");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Up Next", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

/** Resets both accounts and logs each into its own browser context. */
export async function twoFriendsToBe(browser: Browser) {
  await resetAccount(ACCOUNTS.a);
  await resetAccount(ACCOUNTS.b);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await logIn(pageA, ACCOUNTS.a);
  await logIn(pageB, ACCOUNTS.b);
  return {
    pageA,
    pageB,
    close: async () => {
      await contextA.close();
      await contextB.close();
    },
  };
}

/** B sends A a request from A's profile; A accepts from B's. */
export async function befriend(pageA: Page, pageB: Page) {
  await pageB.goto(`/friends/${ACCOUNTS.a.handle}`);
  await expect(pageB.getByRole("heading", { name: ACCOUNTS.a.name })).toBeVisible({
    timeout: 10_000,
  });
  await pageB.getByRole("button", { name: "Add friend" }).click();
  await expect(pageB.getByRole("button", { name: "Requested · Cancel" })).toBeVisible({
    timeout: 10_000,
  });
  await pageA.goto(`/friends/${ACCOUNTS.b.handle}`);
  await expect(pageA.getByRole("button", { name: "Accept request" })).toBeVisible({
    timeout: 10_000,
  });
  await pageA.getByRole("button", { name: "Accept request" }).click();
  await expect(pageA.getByRole("button", { name: "Friends ✓" })).toBeVisible({
    timeout: 10_000,
  });
}

/** Opens Anime (empty after a reset), searches Jikan and adds the top hit. Returns its title. */
export async function addFirstAnime(page: Page): Promise<string> {
  await page.goto("/anime");
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
  return title!;
}
