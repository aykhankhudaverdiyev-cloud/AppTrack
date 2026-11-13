# HANDOFF — AppTrack Rebuild Status

> Read this first in every new session. It is the single source of truth for
> where the counselor-spec rebuild stands and what comes next.

## Phase 4 — implemented; live smoke test pending (2026-11-05)

- `src/components/academic/AcademicSection.jsx` provides the six existing
  academic/activity views, unified activity filters, graduate publications,
  education grade grid, score sending, project links and Top 5 ordering.
- `StudentDashboard.jsx` loads owner-scoped academic rows, subscribes to changes
  and uses `computeAcademicCounts` for completion. Graduate experience counts
  work/internship/career/research activities; research counts publications,
  research-paper projects and research activities.
- `ProfileServiceV2.js` contains academic CRUD, child sync, SAT validation,
  expiry and an idempotent localStorage import. Import keeps the original local
  keys and a retry ledger; recommendation/portfolio keys are untouched.
- `useAutosave` tracks revisions so edits during an in-flight save are retried.
- Verification: 50 tests pass, touched new files lint clean, existing dashboard
  still has 22 pre-existing lint errors. Build passes with Supabase variables
  set. Six academic tabs rendered with representative data in server-side React.
  Mocked import partial-failure/retry was tested. **No live Supabase or browser
  click-through was possible**: verify CRUD, reload, migration, realtime, score
  sending, Top 5, child rows and privacy against a real student account before
  merging. Document pickers remain Phase 5; public project exposure is not added.
- `origin/main` is `f3334ca`; Phase 3 is present. Essays components are not
  present on this base. Phase 5 remains next after Phase 4 verification.

## Current state (2026-11-03)

**Phase 3 — Applications (§11): COMPLETE on `arena/728c3903-apptrack`.**
This branch is based on `main` @ `c5f1e65` (Phase 0 v2 + Phase 1). The full
Applications workspace is implemented; no new SQL migration is needed — all
tables/columns were already live from Phase 0.

**Phase 2 — Essays (§10): COMPLETE on the separate branch
`arena/28c2a1f8-apptrack`** (2 commits, no PR opened / not merged into `main`
yet — the user merges). Phase 3 talks to the same live DB tables
(`essays` + `application_essays`) and degrades gracefully if the Essays tab is
not present in a build, so the two branches can be merged in either order.
The `StudentDashboard.jsx` diff on that branch is only 7 lines (import, tab,
render block), so conflicts with Phase 3 are small.

### Phase 3 — what is implemented

| Piece | Where |
|---|---|
| Additive application columns + public-column whitelist (privacy) | `src/store/studentsStore.js` (`APPLICATION_COLUMNS`, `PUBLIC_APPLICATION_COLUMNS`, `mapApplicationRow`, `saveApplication`) |
| Full tabbed application editor: Basics · Portal & fee · Fit & research · Programmes · Deadlines · Checklist · Interviews · Decision & aid | `src/components/ApplicationModal.jsx` + `ApplicationModal.css` |
| Rules, option lists mirroring DB CHECKs, checklist generator, progress maths, HKU 3 / NTU 5 | `src/utils/applicationRequirements.js` (+ tests) |
| Pure form → DB payload conversion (legacy guarantees) | `src/utils/applicationPayload.js` (+ tests) |
| Timezone form bridge, zone defaults, `describeStoredDeadline` | `src/utils/timezone.js` (+ tests) |
| DB helpers for the 5 child tables, legacy `deadline` + `progress_percent` caches | `src/Services/ProfileServiceV2.js` (appended) |
| Overview widgets: next deadline, pipeline, upcoming deadlines | `src/components/applications/AdmissionsOverview.jsx` (+ CSS in `StudentDashboard.css`) |
| Enhanced application cards: fit/round/progress chips, next-deadline strip, quick tabs, delete confirmation | `src/pages/StudentDashboard.jsx` |

Details:

- **Legacy is untouched.** `university, program, major, term, deadline,
  status, decision, recommendation, notes, visibility` and `student_id`/`user_id`
  still write exactly as before. AdminDashboard, PublicStudentDrawer,
  HomePage/Explore, `StatusBadge`, `VisibilityToggle` (admin-approved flow) and
  the realtime channels still read the same shape. New columns are additive and
  only written when the caller supplies them, so a legacy quick-save never
  wipes Phase 3 data.
- **Public privacy:** `getPublicStudents()` now selects an explicit whitelist
  of legacy columns, so portal URL/email, applicant ID, fee, aid results,
  decision conditions etc. can never leak through `select('*')` on public rows.
- **University autocomplete** from the 123-row `universities` table; free text
  always allowed, `university_id` set on an exact match, country auto-filled.
  Country for free-text apps is kept in `localStorage` (no schema change).
- **Programme choices** ranked with `SortableList` (drag + ↑↓). HKU max 3, NTU
  (Nanyang / National Taiwan) max 5, enforced in UI and service.
- **Deadlines** entered in the ORIGINAL zone (`zonedTimeToUtc`) and always shown
  as original + student-local (Baku) with countdown and day-shift warning
  (US 23:59 → next morning). The main `application` deadline keeps the legacy
  `applications.deadline` DATE in sync using the **original** date. Incomplete
  rows are not saved until they have a date/time.
- **Checklist** generated from level + platform + country (Common App, UC, UCAS,
  Coalition, QuestBridge, OUAC, graduate/PhD, aid, country documents), fully
  editable, custom rows preserved on regenerate, essay requirements can be
  linked to Phase 2 essays (`meta.essayId` + "Sync essay statuses"), and
  `progress_percent` is recomputed + cached whenever the checklist changes.
- **Interviews** repeatable, timezone-aware, with prep notes and thank-you date.
- **Decision & aid** full block; the decision-letter document picker is
  deliberately deferred to Phase 5 (the DB column exists).
- **Portal passwords are NEVER stored** — URL + login email + applicant ID only,
  with an explicit UI warning.
- **Overview widgets** (Phase 1 leftovers): next-deadline card, application
  pipeline (4 status groups + average checklist progress) and upcoming
  deadlines (top 5 + legacy date-only rows with an "add a time zone" hint).
- **"App Progress" stat card** now uses cached `progress_percent`, falling back
  to the old status ratio for applications without a checklist.

### Verification (this branch)

- `npm test` → **45/45** tests pass (timezone 18, requirements 12,
  payload 7, profile completion 8). `package.json` now runs `src/utils/*.test.js`.
- `npm run build` → passes (with dummy Supabase env vars; chunk-size warning
  is pre-existing).
- `npx eslint` on all touched/new files → clean. `StudentDashboard.jsx` still
  has the same **22 pre-existing errors** as before (unchanged count, no new
  ones). Do not "fix" them as a side quest.
- A jsdom + mocked-Supabase React smoke test rendered all 8 tabs with zero
  runtime errors, including add-row actions, loaded HK/NY deadlines (day-shift
  warning), the generated checklist and linked essays.
- No live Supabase credentials in the sandbox → no real click-through smoke test
  was possible. **Please smoke test:** create application → pick university → add
  programme choice → add HK 12:00 / NY 23:59 deadline → generate checklist →
  change a status → link an essay → check Overview next-deadline card, and
  verify the admin/public views still render.

## Known deferred items

- Phase 1 leftovers still open: E.164 phone with country-code dropdown,
  "Request change" on counselor-managed fields.
- Phase 2 leftovers: counselor comment writing UI (Phase 6), `essay_shares`.
- Phase 3 leftovers: `decision_letter_document_id` picker (Phase 5),
  `supervisor_contacts` UI (§18 / Phase 6), `aid_policy` is on the form but a
  global aid-policy library is Phase 5.
- Legacy-table RLS + `public_directory` view are still deferred (together).

## Order after this

Phase 4 libraries (§4–9) → Phase 5 Docs/Recs/Aid/Deadlines (§12–15) →
Phase 6 Links/Portfolio/CV/Counselor dashboard (§16–19).

## Critical repo facts (do not break these)

1. Live legacy tables: `profiles, applications, application_documents,
   licenses, license_media, visibility_requests`. Never drop/alter without OK.
2. `document_files` is the new library table (NOT the stale `documents`).
3. Visibility flow today is admin-approved (`visibility_requests`) — keep it.
4. `avatars` bucket is PUBLIC by design (`getPublicUrl()`).
5. RLS counselor anchor: `profiles.counselor_id`; legacy `assigned_counselor`
   text column stays.
6. All UI strings in **ENGLISH** (en-GB). Azerbaijani is chat-only.
7. Sensitive data (passport, DOB, addresses, transcripts, essays) is private
   and cannot be made public. Showcase items may be toggled public.
8. Portal passwords are never stored.
9. **No single university per student.** `profiles.university`,
   `profiles.major` and `profiles.committed_university` were dropped in
   migration `005` — a student's universities live in `applications`
   (`university`, `university_id`, `program`, `major`), intended majors in
   `profiles.intended_major_1/2`. Never re-add a profile-level university/major
   field (Complete Profile collects name, phone and gender only).

## Standing rules (user-mandated)

- **NO arena co-author trailers.** Overwrite `.git/hooks/commit-msg` at session
  start, commit with `git commit --no-verify`, then check
  `git log origin/main..HEAD --format=%B | grep -ci arena` → **must be 0**
  before pushing. Amend + force-push-with-lease if not.
- The **USER merges PRs** (Squash and merge on GitHub). Never run
  `gh pr merge` / `gh pr close`. Open a PR (`gh pr create`) only if asked.
- Push only to the current session branch.
- Keep the existing style: cards, purple gradient (#7c3aed → #6d28d9), emoji
  icons, empty states. Prefer extending existing files over new ones.
- Short answers in Azerbaijani; UI text in English.
