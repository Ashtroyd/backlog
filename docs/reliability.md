# Reliability and offline behaviour

Backlog saves all four library sections on sign-in and reconnection. Data is
keyed by account in IndexedDB; sign-out clears the device copy. Service-worker
installation saves route HTML and its build files. Offline mode is read-only:
it does not queue changes. Cover art is available only when previously cached.

Quick Search shows your saved titles first and opens their detail sheet. It
works with the device copy offline. Online discovery is kept separate.

Continue cards check released series/anime episodes using TVMaze/Jikan. Unknown
air dates and oversized sources produce no badge rather than a guessed count.
Optional device notifications require browser permission and a service worker.
The first check establishes a baseline; only subsequent increases notify.
Checks run while Backlog is open, not as background push. Background delivery
still needs a scheduled server sender and push credentials.

`GET /api/health` checks database reachability without returning rows. Responses
are uncached and use a five-second database timeout. It does not prove every
table or third-party content source is healthy.

Unhandled browser failures and React boundaries report to `/api/errors`, and
Next.js server failures use `onRequestError`. Vercel runtime logs contain crash
class, digest, static bundle frames and deployment revision, never form values,
raw messages, headers, cookies or account identifiers. Client reports are
deduplicated and burst-limited per function instance. No paid integration or
automatic error-alert destination has been configured.

Database advisors were reviewed on 2026-10-06. Top-pick policies now evaluate
identity once and have separate write policies; the missing item FK index was
added. Leaked-password protection remains a dashboard/plan-dependent setting.

Verification: `npm run lint`, `npm run build`,
`node --experimental-strip-types --test tests/*.unit.mjs`, and `E2E_PRODUCTION=1 npx playwright test`
against a running production build on port 3100. Account-backed tests only use
the existing reusable E2E accounts.
