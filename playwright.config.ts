import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// The account helpers talk to Supabase directly, so they need the same
// public URL/key the app uses, plus E2E_PASSWORD for the reusable accounts
// (kept out of git in .env.test.local). CI provides both as env vars.
for (const file of [".env.test.local", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  // Every account-backed test resets and reuses the same two accounts, so
  // they must run one at a time.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    // CI builds first (workflow step), then serves the production bundle;
    // locally the dev server is enough.
    command: process.env.CI
      ? "npm run start -- -p 3100"
      : "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
