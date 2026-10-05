# TASKMASTER
#### Video Demo: https://www.youtube.com/watch?v=8FWKxPP71g8
#### Vercel link: https://taskmaster-gamma-bay.vercel.app/

A multi-user habit counter. Create Daily, Weekly or Monthly habits, tap **+** to log a completion, and watch your streak grow. Completed habits sink to the bottom and reset automatically when the next period starts.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · MongoDB Atlas · Tailwind CSS 4 · Vitest

## Features
- Email + password accounts; every habit belongs to one user (session cookie, bcrypt-hashed passwords)
- Create, rename, change frequency, and bulk-delete habits
- Completion is tied to the counter; one completion per period, enforced by the server
- Streaks and best streaks, computed per habit type and in the user's own time zone
- Inline editing, error banners (no `alert()` popups), refresh on tab focus so the list is right after midnight

## How it works
```
page.tsx ─ session check ─▶ AuthForm | Dashboard ─▶ HabitRow / Modal
                                  │ fetch (+ X-Timezone header)
                                  ▼
            /api/auth/{register,login,logout,me}
            /api/habits            GET · POST · DELETE
            /api/habits/[id]       PATCH (name | type | count)
            /api/habits/[id]/complete   POST
                                  ▼
        lib/{auth,validation,habits,period,mongodb,http}.ts ─▶ MongoDB Atlas
```

**Recurrence without cron jobs.** No "done" flag is stored. Each habit stores when it was last completed; `lib/period.ts` maps any instant to an integer *period number* for its type (day / ISO week / month) in the user's time zone. "Completed this period" is `lastPeriod === currentPeriod`, and "the streak continues" is `lastPeriod === currentPeriod - 1`. Month, year and leap-day rollovers fall out of the arithmetic.

**Correctness under concurrency.** Completing a habit is a read-modify-write guarded by a `version` field (compare-and-swap): if two requests race (two tabs, double tap), only one write matches and the other re-reads and is rejected with `409`. The count can never be double-incremented.

**Server is the source of truth.** The server picks the timestamp and computes streaks, so changing your device clock can't cheat. `PATCH` accepts only `name`, `type` and `count` and validates each; `userId`, `createdAt`, streaks etc. in a request body are ignored. Every query includes the authenticated `userId`, so one user can't read, edit, complete or delete another's habits (covered by tests).

## Running locally
```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI and AUTH_SECRET
npm run dev                    # http://localhost:3000
```
`AUTH_SECRET` is any random string of 32+ characters: `openssl rand -base64 32`.

## Tests and checks
```bash
npm test          # 40 tests: period maths, streaks, validation, auth tokens, API + isolation + concurrency
npm run check     # lint + typecheck + tests + production build (also runs in GitHub Actions)
```
API tests run the real route handlers against an in-memory fake of the Mongo collection, so they need no database. The compare-and-swap test forces ten callers to hold the same stale read and asserts exactly one wins.

## Deploying to Vercel
1. Push this repo to GitHub and import it in Vercel.
2. In **Settings → Environment Variables** add `MONGODB_URI`, `AUTH_SECRET` and (optional) `MONGODB_DB`.
3. In Atlas, **Network Access**, allow `0.0.0.0/0` (Vercel's IPs are dynamic) and use a database user with access to the `taskmaster` database only.
4. Deploy. Indexes (unique `users.email`, `habits.{userId,createdAt}`) are created automatically on first request.

## Upgrading from the first version
Habits created before accounts existed have no `userId`, so they no longer appear. Easiest path: start fresh, or sign up and re-create them.

## Known limitations / next steps
- No rate limiting on login (needs a shared store such as Upstash Redis on serverless).
- Sessions are stateless JWTs: logging out clears the cookie but can't revoke a stolen token before its 7-day expiry.
- If a user changes time zone, a habit's current period is judged in the new zone (can cause one off-by-one day).
- No email verification or password reset.
- Tests don't hit a real MongoDB; the fake mirrors only the operations the app uses.
