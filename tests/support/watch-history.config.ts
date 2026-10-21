import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
const cwd = resolve(__dirname, '../..');
export default defineConfig({
  metadata: { isolatedWatchHistory: true },
  testDir: '..', testMatch: 'watch-history.spec.ts', workers: 1,
  timeout: 60_000, use: { baseURL: 'http://localhost:3102', trace: 'retain-on-failure', actionTimeout: 10_000 },
  webServer: [
    { cwd, command: 'node tests/support/review-server.mjs', url: 'http://127.0.0.1:3101/__review/state', reuseExistingServer: false },
    { cwd, command: 'npm run dev -- --port 3100', url: 'http://127.0.0.1:3100', timeout: 120_000, reuseExistingServer: false,
      env: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3101', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'review-only' } },
  ],
});
