import { expect, test } from "@playwright/test";

// Browser-only auth/data fixtures: no real accounts, emails or database writes.
const user = { id: "11111111-1111-4111-8111-111111111111", email: "picker@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const base = { user_id: user.id, cover_url: null, release_year: 2025, genres: ["Adventure"], meta: {}, status: "backlog", rating: null, review: null, is_private: false, is_favorite: false, started_at: null, progress: null, hours_played: null, notes: null, pinned_at: null, live_service: false, current_thoughts: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", completed_at: null };
const rows = [
  { ...base, id: "g1", external_id: "1", title: "Portal", media_type: "game", genres: ["Puzzle"], pinned_at: "2026-01-01" },
  { ...base, id: "g2", external_id: "2", title: "Hades", media_type: "game", genres: ["Action"] },
  { ...base, id: "m1", external_id: "3", title: "Arrival", media_type: "movie", genres: ["Drama", "Mystery"] },
  { ...base, id: "a1", external_id: "4", title: "Spy Family", media_type: "anime", genres: ["Comedy"] },
  { ...base, id: "s1", external_id: "5", title: "Severance", media_type: "series", genres: ["Thriller"] },
  { ...base, id: "g3", external_id: "6", title: "Stardew Valley", media_type: "game", genres: ["Casual"], status: "on_hold" },
];

async function openPicker(page: import("@playwright/test").Page, failLoad = false, fixtureRows = rows) {
  await page.addInitScript(() => localStorage.setItem("backlog:tourSeen", "1"));
  await page.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    let body: unknown = [];
    if (url.pathname.includes("/auth/v1/token")) {
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
      body = { access_token: token, refresh_token: "fixture-only", expires_in: 3600, token_type: "bearer", user };
    } else if (url.pathname.endsWith("/user")) body = user;
    else if (url.pathname.endsWith("/profiles")) {
      const profile = { id: user.id, username: "picker", display_name: "Picker", avatar_url: null, banner_url: null, bio: null, home_layout: null };
      body = request.headers().accept?.includes("object") ? profile : [profile];
    } else if (url.pathname.endsWith("/items")) {
      if (failLoad && url.searchParams.get("order") === "id.asc") {
        return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Fixture query failure" }) });
      }
      body = fixtureRows.filter((row) => [...url.searchParams].every(([key, value]) => {
        if (value.startsWith("eq.")) return String(row[key as keyof typeof row]) === value.slice(3);
        return true;
      }));
      if (url.searchParams.has("or")) body = [];
    }
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "0-0/1" }, body: JSON.stringify(body) });
  });
  await page.route("**/api/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [], ok: true }) }));
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("fixture-only-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("button", { name: "Help me choose" }).click();
  await expect(page.getByRole("heading", { name: "What should I start?" })).toBeVisible();
  return () => { failLoad = false; };
}

for (const width of [390, 1440]) test(`picker filters, alternatives and title details at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await openPicker(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Portal", exact: true })).toBeVisible();
  await expect(dialog.getByText("You pinned this to Up Next.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "What should I start?" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Help me choose" })).toBeFocused();
  await page.getByRole("button", { name: "Help me choose" }).click();
  await dialog.getByRole("button", { name: "See other picks" }).click();
  await expect(dialog.getByRole("heading", { name: "Spy Family", exact: true })).toBeVisible();
  await dialog.getByLabel("In the mood for").selectOption("movie");
  await dialog.getByLabel("Time available").selectOption("30");
  await expect(dialog.getByText("No matches for this combination.")).toBeVisible();
  await dialog.getByLabel("Time available").selectOption("120");
  await expect(dialog.getByRole("heading", { name: "Arrival", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Some action", exact: true }).click();
  await expect(dialog.getByText("No matches for this combination.")).toBeVisible();
  await dialog.getByRole("button", { name: "Show all waiting titles" }).click();
  await expect(dialog.getByText("6 matching titles", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 390) await page.screenshot({ path: test.info().outputPath("picker-mobile.png"), fullPage: true });
  await dialog.getByRole("button", { name: /Games Portal/ }).click();
  await expect(page.getByRole("heading", { name: "Portal", exact: true, level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What should I start?" })).not.toBeVisible();
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  expect(errors).toEqual([]);
});

test("picker shows library failures instead of pretending the backlog is empty", async ({ page }) => {
  const restoreLoad = await openPicker(page, true);
  await expect(page.getByText("Your library couldn’t load. Check your connection and try again.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  restoreLoad();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Portal", exact: true })).toBeVisible();
});

test("an empty library gives a clear next step", async ({ page }) => {
  await openPicker(page, false, []);
  await expect(page.getByText("Nothing waiting to start.")).toBeVisible();
  await expect(page.getByText("Add a title to your backlog, then come back for a pick.")).toBeVisible();
});
