import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { ACCOUNTS, SKIP_REASON, hasAccounts, logIn, resetAccount } from "./support/accounts";

test("saved-library search and Continue episode availability work offline", async ({ page, context }) => {
  test.skip(!hasAccounts, SKIP_REASON);
  const userId = await resetAccount(ACCOUNTS.a);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await db.auth.signInWithPassword({ email: ACCOUNTS.a.email, password: process.env.E2E_PASSWORD! });
  expect(login.error).toBeNull();
  const { data: item, error } = await db.from("items").insert({
    user_id: userId, media_type: "series", external_id: "1", title: "Offline episode fixture",
    status: "in_progress", progress: 2, meta: { episodes: 13 },
  }).select("id").single();
  expect(error).toBeNull();
  await db.auth.signOut();
  await page.route("**/api/episodes?**", (route) => route.fulfill({ json: {
    availability: { aired: 5, latestAirAt: "2026-09-01T00:00:00Z", nextAirAt: null },
  } }));
  await logIn(page, ACCOUNTS.a);
  await expect(page.getByText("3 episodes available", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByLabel("Quick search").fill("Offline episode");
  const own = page.getByRole("region", { name: "Your library" });
  await expect(own.getByRole("button", { name: /Offline episode fixture/ })).toBeVisible();
  await page.keyboard.press("Escape");
  // Confirm the IndexedDB transaction completed before disconnecting.
  await expect.poll(() => page.evaluate(async (key) => {
    return new Promise<boolean>((resolve) => {
      const open = indexedDB.open("backlog", 1);
      open.onsuccess = () => {
        const request = open.result.transaction("cache").objectStore("cache").get(key);
        request.onsuccess = () => { resolve(!!request.result?.length); open.result.close(); };
      };
      open.onerror = () => resolve(false);
    });
  }, `items:${userId}:series`)).toBe(true);
  if (process.env.E2E_PRODUCTION === "1") {
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  }
  await context.setOffline(true);
  await page.keyboard.press("Control+k");
  await page.getByLabel("Quick search").fill("Offline episode");
  await expect(own.getByRole("button", { name: /Offline episode fixture/ })).toBeVisible();
  await expect(page.getByText("Search saved titles offline.", { exact: false })).toBeVisible();
  if (process.env.E2E_PRODUCTION !== "1") await context.setOffline(false);
  await own.getByRole("button", { name: /Offline episode fixture/ }).click();
  await expect(page).toHaveURL(new RegExp(`/series\\?item=${item!.id}`));
  await expect(page.getByRole("dialog").getByText("Offline episode fixture", { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
});

test("health check and crash endpoint validate requests", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", database: "reachable" });
  const forbidden = await request.post("/api/errors", { data: { name: "Error" } });
  expect(forbidden.status()).toBe(403);
  const invalid = await request.post("/api/errors", { headers: { origin: "http://localhost:3100" }, data: { name: "<script>" } });
  expect(invalid.status()).toBe(400);
  const unsupported = await request.get("/api/episodes?type=movie&id=1");
  expect(unsupported.status()).toBe(400);
});
