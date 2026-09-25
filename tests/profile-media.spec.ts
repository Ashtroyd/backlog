import { test, expect, type Page } from "@playwright/test";
import { ACCOUNTS, SKIP_REASON, hasAccounts, logIn, resetAccount } from "./support/accounts";

/**
 * Profile photo and banner uploads end to end: crop → upload to the
 * avatars bucket → saved on the profile → shown, and still shown after a
 * reload. Guards the storage policies (see migration 0015) — when they were
 * wrong, every upload failed without a word.
 */

/** A solid-colour PNG, made in the page so the test needs no fixture file. */
async function png(page: Page, colour: string): Promise<Buffer> {
  const b64 = await page.evaluate((c) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1800;
    canvas.height = 700;
    const g = canvas.getContext("2d")!;
    g.fillStyle = c;
    g.fillRect(0, 0, 1800, 700);
    return canvas.toDataURL("image/png").split(",")[1];
  }, colour);
  return Buffer.from(b64, "base64");
}

async function upload(page: Page, input: number, colour: string, confirmation: string) {
  await page
    .locator('input[type="file"]')
    .nth(input)
    .setInputFiles({ name: "image.png", mimeType: "image/png", buffer: await png(page, colour) });
  await page.getByRole("dialog").getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(confirmation)).toBeVisible({ timeout: 20_000 });
}

test("a banner and profile photo upload, replace, and survive a reload", async ({ page }) => {
  test.skip(!hasAccounts, SKIP_REASON);
  await resetAccount(ACCOUNTS.a);
  await logIn(page, ACCOUNTS.a);
  await page.goto("/profile");
  const banner = page.locator('main img[src*="/banner.jpg"]');

  // First banner (a new file), then a replacement (overwrites it in place).
  await upload(page, 1, "#2a9d8f", "Banner updated.");
  await expect(banner).toBeVisible();
  const first = await banner.getAttribute("src");
  await upload(page, 1, "#e76f51", "Banner updated.");
  await expect(banner).not.toHaveAttribute("src", first!);

  await upload(page, 0, "#264653", "Profile photo updated.");
  await expect(page.locator('main img[src*="/avatar.jpg"]').first()).toBeVisible();

  await page.reload();
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('main img[src*="/avatar.jpg"]').first()).toBeVisible();
});
