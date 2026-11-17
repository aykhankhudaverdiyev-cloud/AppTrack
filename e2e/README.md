# E2E tests (Playwright)

## Running

```
npm install        # installs @playwright/test (already in devDependencies)
npx playwright install chromium   # one-time browser download
set -a; source .env.e2e; set +a
npm run test:e2e
```

`playwright.config.js` builds the app and runs `vite preview` on
`http://localhost:4173` automatically (`webServer`), so you do not need a
server running beforehand — but you do need `E2E_EMAIL` / `E2E_PASSWORD`
set to a dedicated test account before the specs that need login will run;
otherwise they report `skipped`, not `passed`.

## Test account

A dedicated Supabase auth user was created for this suite — **not** a real
student account — via direct SQL against `auth.users`/`auth.identities`
(email auto-confirmed, matching the project's `mailer_autoconfirm: true`
setting). Credentials are in `.env.e2e` (git-ignored, matches the `.env.*`
pattern already in `.gitignore`):

- `E2E_EMAIL=e2e.apptrack.test@example.com`
- `E2E_PASSWORD=E2eTest!2026Pw`

Every spec that creates an honor or test attempt deletes it again at the end
of the same test, so the account's `honors` / `test_attempts` tables are
expected to be empty between runs.

## Known sandbox limitation

This repository was worked on inside a network-sandboxed environment whose
outbound access is limited to `github.com`, `registry.npmjs.org`,
`pypi.org`, and a few related hosts. `npx playwright install chromium`
needs to reach `cdn.playwright.dev`, which is **not** on that allow-list, so
the browser binary could not be downloaded and these specs could not be
executed inside that sandbox. The test runner (`@playwright/test`) is
installed, the specs below are written and lint-clean, and `npx playwright
test --list` successfully enumerates all 6 of them — only the actual browser
run is blocked by the sandbox's network policy. Run them in a normal CI
environment or a machine with network access to verify.

## Specs

- `honors.spec.js`
  - create a complete honor end to end (fill Basics, grade levels, level of
    recognition), confirm the draft completion counter and the "Create
    honor" button, then delete it again
  - the draft card never shows the `⋯` menu (bug A5)
  - the category `<select>` in the panel header is interactive (bug A4)
  - opening "+ Add honor" from an empty list keeps the "All" filter chip
    selected instead of silently switching to a 0-count category chip (the
    "Olympiad 0" bug reproduced in the bad-example screenshot)
- `test-scores.spec.js`
  - the list/panel grid switches to the 60%-panel layout while a panel is
    open
  - IELTS section scores compute the suggested overall via the documented
    round-to-nearest-0.5 rule
  - the document picker opens and lists the user's documents immediately
