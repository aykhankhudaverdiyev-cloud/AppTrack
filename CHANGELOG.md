# AppTrack — Changelog

Rebuild driven by the college-counselor specification (20 sections). Delivered in phases.

---

## Projects — rebuilt as its own page (2026-11-13)

**Status:** ready · **Branch:** `arena/1ed31615-apptrack`

### What changed, where

- **New page** `src/components/projects/ProjectsSection.jsx` (+ `.css`):
  "Projects" header with the en-GB subtitle and the purple gradient
  "+ Add project", category chips (`All 3`, `Software 2`, `Research 1`),
  project cards (emoji tile, title, one-line summary, neutral tech tags,
  status pill, ⋯ menu, "Linked to Activities" note) on the left at 40 % and a
  sticky panel on the right at 60 % with a 24 px gap. Selected card = 2 px
  purple border + light purple tint. Below 900 px the panel is a full-screen
  sheet.
- **Panel** `ProjectPanel.jsx`: BASICS (title, Solo / Team lead / Team member,
  start date MM/YYYY, In progress / Live / Paused), DETAILS (Problem ≤300,
  What you built ≤500, Result ≤300 — each with a live counter and a 4 px green
  progress track), TECH AND LINKS (tag input with removable chips, GitHub,
  live demo), CONNECTIONS (linked activity, Private / Public + helper).
  800 ms autosave + blur, inline validation, "Saved 2 s ago ✓" status, create
  mode with a sticky footer and a discard confirm.
- **Data layer**: `src/Services/projectsApi.js` (whitelisted columns only,
  owner-scoped), `src/hooks/useProjects.js` (optimistic + rollback),
  `src/constants/projectTypes.js`, `src/utils/projects.js` with 11 unit tests.
- **Removed** the old projects form from `AcademicSection.jsx` (and its
  `saveProject` import + team-contribution rule). `AcademicCollection` is now
  exported so graduate publications render under the Projects cards.
  `StudentDashboard.jsx` renders the new page for `?tab=projects`, keeps
  `?type=` / `?id=` in sync and labels the tab "Projects".
- **Migration** `007_projects_redesign.sql` (Supabase: `projects_redesign`):
  `build_summary`, fixed role/status sets (`team` → `team_member`,
  `completed`/`maintained` → `live`, `idea` → `paused`), length and tag-count
  CHECKs, `(user_id, created_at)` index. RLS untouched, no seeded rows.

### Verification

- `npm test` → **77/77** (66 existing + 11 new project helper tests).
- `npm run build` → passes with `.env.local` set.
- `npx eslint .` → 43 errors, all pre-existing (baseline unchanged).
- jsdom run against a stubbed PostgREST: 55/55 checks — chips
  `All 3 | Software 2 | Research 1`, cards/tags/pills/linked note, panel
  sections and labels, counters, progress tracks, tech chips, the
  linked-activity select, one debounced PATCH (whitelisted columns only),
  create flow `0 of 1` → `✓ 1 of 1` → POST → toast, delete confirm → DELETE →
  Undo POST, paused/public panel state, research 🔬 tile.
- Live DB: the four new CHECKs reject `status = 'idea'`, `role_type = 'team'`,
  13 tech tags and a 501-character build summary (probe rows rolled back).
- `public.projects` / `public.activities` currently hold 0 rows, so nothing was
  lost by the value normalisation.

## Phase 0 — Foundation: DB schema, RLS, timezone utils, shared form components

**Status:** ready · **Date:** 2026-11-01

### What changed, where

#### Supabase migrations (new — `supabase/migrations/`)
| File | Contents |
|---|---|
| `001_schema_extensions.sql` | **33 new tables**: universities, profile_private, parents, education_entries, grade_rows, test_attempts, test_section_scores, score_sending, honors, activities, projects, publications, application_choices, application_deadlines, application_requirements, interviews, supervisor_contacts, essays, essay_versions, essay_comments, essay_shares, application_essays, documents, document_versions, document_links, recommenders, recommendation_assignments, financial_profile, aid_forms, scholarships, links, portfolio_items, reminders. `profiles` + `applications` extended (55+ new columns: structured names, goals, portal, fee, fit, decision, aid). `updated_at` triggers, indexes. |
| `002_rls_policies.sql` | **RLS everywhere**: owner (full) + counselor (assigned students only, via `profiles.counselor_id`) + admin. `public_directory` view — the only public door; sensitive columns (passport, DOB, addresses) are NOT part of the view at all. |
| `003_storage.sql` | `student-documents` & `avatars` buckets forced **private**; owner-folder policies (`{user_id}/...`), counselor read-only, signed URLs (1 h). |
| `004_seed_universities.sql` | ~110 universities seeded (AZ, TR, US, UK, CA, HK, SG, TW, KR, EU) for application autocomplete. |
| `README.md` | SQL Editor run guide (order + verification). |

#### Privacy architecture (acceptance criterion, spec 0.6)
- Personal data (DOB, passport, addresses, household) lives in a separate **`profile_private`** table — it cannot leak through public `profiles` queries.
- Sensitive document categories (passport, transcript, bank statement, recommendation copy, ...) are covered by a **CHECK constraint**: `is_public = true` is impossible even via direct API calls.
- Essays have no `visibility` column at all: sharing only via explicit `essay_shares` rows (specific users).
- Portal passwords are never stored (URL + login email + applicant ID only) — spec 0.7.

#### Timezone system (new — `src/utils/timezone.js`)
- `zonedTimeToUtc('2027-01-05','12:00','Asia/Hong_Kong')` → exact UTC instant (DST-aware, two-pass offset resolution)
- `describeDeadline()` → local time + original time + GMT label + countdown + day shift (US 23:59 → next morning in Baku = `dayShift: 1`)
- `suggestReminderTimes()` → 30/14/7/3/1-day and day-of reminder instants
- **12/12 tests pass** (`src/utils/timezone.test.js`, `npm test`): acceptance criterion — HK 12:00 → Baku 08:00, New York 23:59 → Baku 08:59 (next day) ✅
- All user-facing strings and default locale are English (en-GB).

#### Shared form components (new — `src/components/forms/`)
| Component | Purpose | Spec |
|---|---|---|
| `Field` | Accessible wrapper: label + hint + inline error (aria-*) | #9, #10 |
| `ValidatedInput` / `ValidatedSelect` | Inline errors that explain the rule ("SAT section scores are 200–800 in steps of 10") | #9 |
| `CharWordCounter` | Live character AND word counts; binding limit emphasised; over-limit warning | #4 |
| `MonthYearPicker` | Month + year selects (structured dates) | #3 |
| `ConfirmDialog` | Confirmation for every delete (Escape, focus control) | #8 |
| `SortableList` | Drag-to-reorder + keyboard ↑↓ (mobile friendly) | #8, #10 |
| `useAutosave` / `useUnsavedGuard` | Debounced draft autosave + close warning | #8 |
| `src/constants/activityTypes.js` | Common App 27 categories + filter chips (Volunteering, Work & Internships, ...) + CA/UC limits | #1, §7 |

Styling follows the existing design language: purple gradient (`#7c3aed → #6d28d9`), soft shadows, card radii, 16px mobile inputs (iOS zoom guard).

#### Other
- `package.json`: added `npm test` (node:test, zero dependencies).
- No visual change to the site — Phase 0 is pure foundation; UI wiring starts in Phase 1.

### Acceptance criteria status
| Criterion | Status |
|---|---|
| Modal fields + validation + counters | 🟡 toolkit ready — modals land in later phases |
| Profile completion correct on an empty profile | ⬜ Phase 1 |
| Deadlines show correct local time for Asia/Baku (source Asia/Hong_Kong / America/New_York) | ✅ 12/12 tests |
| Sensitive categories cannot be made public even via direct API calls | ✅ CHECK + RLS + excluded from `public_directory` |

---

## Phase 1 — My Profile rebuild + Profile completion fix

**Status:** ready · **Date:** 2026-11-02

### My Profile (spec §3) — `src/components/profile/MyProfileSection.jsx` + CSS
New structured, level-aware profile editing rendered at the top of the
My Profile tab (all English UI, autosaving per section with explicit dirty
markers, `Saved/Saving…/Save failed` status pills):

| Card | Fields | Storage |
|---|---|---|
| Name | Given / Middle / Family / Preferred / **Name exactly as in passport** (with HKU-NTU-visa hint) / Native script | `profiles` new columns |
| Personal 🔒 always private | DOB, country of birth, citizenship(s), dual citizenship, passport number + expiry (**12-month-before-intended-start warning**), permanent/current address, gender (spec options), pronouns | `profile_private` + `profiles.gender/pronouns` |
| Background | Languages + proficiency (rows editor), first-generation flag, household size, siblings | `profiles` + `profile_private` |
| Parents / Guardians | CRUD list, max 2 parents + 1 guardian, living/deceased, education, occupation, employer, email; delete via ConfirmDialog | `parents` |
| Goals | Applying for (level), start term, intended major 1/2, financial aid yes/no, gap year yes/no — **level drives the Graduate card visibility and the completion weights** | `profiles` |
| Graduate (only Master/PhD) | Current degree, status, work experience years, research interests, ORCID, Google Scholar, LinkedIn | `profiles` |

Supporting service: `src/Services/ProfileServiceV2.js` (whitelisted
camelCase→snake_case writes; parallel reads; owner-only paths, RLS-enforced).

### Profile completion fix (spec §2, acceptance criterion)
- **Old bug:** counted 7 profile fields → showed 86% on an empty academic profile.
- **New engine:** `src/utils/profileCompletion.js` — weighted, level-aware:
  - Bachelor/Transfer/Exchange: Profile 20 · Education 25 · Tests 15 · Honors 10 · Activities 20 · Recommenders 10
  - Master/PhD: Profile 15 · Education 25 · Tests 10 · Research/Publications 20 · Experience 15 · Recommenders 15
- Empty profile now correctly shows **0%** (8/8 tests, `npm test`).
- The Overview card lists the missing items; each item is a button that jumps
  to the relevant tab.

### Overview (spec §2, first slice)
- Stat cards "Public Apps" / "Public Certs" (no action value) replaced by
  **Submitted** (applications) and **Recommenders** counts.
- "Assigned Mentor" → **"Assigned Counselor"** (single term everywhere).
- Removed the duplicated **Snapshot** block from the Profile tab (spec §3).
- Old "Profile Information" card renamed to **Counselor-managed** (Major,
  University, Assigned Counselor, Overall Decision stay read-only there;
  name/gender moved into the editable structured cards).

### Notes
- Academic counts (education/tests/honors/activities/projects/recommendations)
  still come from the current localStorage lists until Phase 4 moves them to
  the new DB tables — completion reflects them correctly in the meantime.
- `useAutosave` fix: no save-on-mount (dirty flag is now explicit).
- Pre-existing lint debt in `StudentDashboard.jsx` (22 errors: unused handlers,
  legacy setState-in-effect) is untouched — separate cleanup, not this phase.


---

## Phase 2 — Essays (§10)

**Status:** ready · **Date:** 2026-11-03 · **Branch:** `arena/28c2a1f8-apptrack`
(not merged into `main` yet — the user merges).

Essays tab in the Admissions group: status-filtered list, editor with a single
autosave for meta + text, type presets (limits/minimums), live char/word counter,
prompt and private notes; manual + automatic version snapshots with restore;
read-only counselor comments with resolve/reopen; essay ↔ application links with
per-university AI-rules notes. No schema change — `essays`, `essay_versions`,
`essay_comments`, `application_essays` were already live from Phase 0.

---

## Phase 3 — Applications rebuild (spec §11)

**Status:** ready · **Date:** 2026-11-03

### What changed, where

| File | Contents |
|---|---|
| `src/components/ApplicationModal.jsx` + `.css` | Rebuilt as an 8-tab workspace. Legacy fields remain in "Basics"; new tabs: Portal & fee, Fit & research, Programmes, Deadlines, Checklist, Interviews, Decision & aid. Top-level fields autosave (debounced `useAutosave`); child rows save on discrete actions/blur with an explicit "Save everything" fallback. |
| `src/store/studentsStore.js` | `APPLICATION_COLUMNS` / `PUBLIC_APPLICATION_COLUMNS` whitelists; `mapApplicationRow()` extended with all new columns (camelCase); `saveApplication()` writes them **additively** (legacy callers cannot wipe them); `term` auto-sync from season/year; `updated_at`. |
| `src/Services/ProfileServiceV2.js` | `searchUniversities`, `fetchUniversityById`, `fetchApplicationWorkspace`, `fetchStudentDeadlines`, `fetchApplicationEssayOptions`, `saveApplicationChoices`, `saveApplicationDeadlines`, `saveApplicationRequirements`, `saveApplicationInterviews`, `saveApplicationEssayLinks` + shared `syncRows` (client UUID upsert). |
| `src/utils/applicationRequirements.js` | Option lists matching every DB CHECK, `getProgramChoiceLimit` (HKU 3 / NTU 5), `generateRequirements()` (level + platform + country), `computeRequirementProgress()`, essay-status mapping. |
| `src/utils/applicationPayload.js` | Pure form → DB payload conversion with legacy-column guarantees (`term` sync, DB-safe null/number/bool, no UI-only keys). |
| `src/utils/timezone.js` | `COMMON_TIME_ZONES`, `defaultTimeZoneForCountry`, `utcToZonedInput`, `zonedInputToUtcIso`, `describeStoredDeadline` (bad rows cannot break the UI). |
| `src/components/applications/AdmissionsOverview.jsx` | Overview widgets: next deadline (original + local + countdown + day shift), application pipeline, upcoming deadlines. |
| `src/pages/StudentDashboard.jsx` + `.css` | Loads all application columns + deadlines, realtime on deadlines/requirements, enhanced cards (fit/round/progress chips, next-deadline strip, quick Deadlines/Checklist buttons, delete confirmation), "App Progress" from cached progress. |

### Acceptance criteria status

| Criterion | Status |
|---|---|
| Legacy applications/admin/public views still work | ✅ additive mapping + explicit public whitelist |
| University autocomplete + free text fallback | ✅ 123-row `universities` table |
| Ranked programme choices, HKU ≤3 / NTU ≤5 | ✅ `SortableList` + UI + service enforcement |
| Deadlines show original + Baku time, day-shift warning | ✅ 18/18 timezone tests incl. HK 12:00 → 08:00, NY 23:59 → 08:59 next day |
| Legacy `applications.deadline` stays in sync | ✅ original-zone date from the main "application" deadline |
| Checklist generated from level + platform + country, editable | ✅ 12/12 rules tests; custom rows survive regenerate |
| `progress_percent` cached and feeding Overview | ✅ recomputed on every checklist save |
| Essays linked into the checklist | ✅ `application_essays` + status sync (Phase 2 compatible) |
| Interviews repeatable + timezone-aware | ✅ |
| Decision + aid result block | ✅ (decision-letter picker → Phase 5) |
| Portal passwords never stored | ✅ URL + login email + applicant ID only, with warning |
| Overview next-deadline / pipeline / upcoming widgets | ✅ Phase 1 leftovers closed |

### Notes

- No migration needed: all tables/columns were live from Phase 0.
- Public directory now uses an explicit legacy-column whitelist — portal
  logins, applicant IDs, fee/aid results cannot leak via `select('*')`.
- `npm test` → 45/45 (timezone 18, requirements 12, payload 7, profile
  completion 8); `npm run build` passes; lint clean on touched files (the 22
  pre-existing `StudentDashboard.jsx` errors are unchanged). A jsdom +
  mocked-Supabase React smoke test rendered all 8 tabs with zero runtime errors.
- Live Supabase click-through was not possible in this sandbox — see
  `HANDOFF.md` for the smoke-test checklist.

---

## Phase 4 — Academic libraries (code complete; live verification pending)

The existing academic tabs now use owner-scoped database libraries with education
and grade grid, tests and score sending, honors, unified activities, projects and
publications. Legacy localStorage entries are imported with retry-safe IDs;
original browser keys remain as backups. Completion and realtime refresh use the
new rows. Autosave tracks changes made during an in-flight save. No public
project data path or document picker was added.

Tests: 50 passing; configured production build passes; six tabs rendered with
representative data in a React server-render smoke test. Live Supabase and browser
click-through remain to be verified before merge; see `HANDOFF.md`.

---

## Cleanup — single-university concept removed (multi-university model everywhere)

`profiles.university` and `profiles.major` encoded "the one university / the one
major" this student belongs to, which contradicts the model where a student
applies to many universities through `applications`. Both are now gone from the
UI, the data layer and the database.

- **Complete Profile** no longer asks for university or major (1216 → 297 lines).
  It collects first/last name, phone (with dial code) and gender only; the whole
  hardcoded `TOP_UNIVERSITIES` catalogue, `SIGNATURE_UNIVERSITY_MAP`, the
  per-university curriculum gate and the locked-field pills are deleted, together
  with ~130 lines of dead CSS. Its upsert no longer writes `university`/`major`.
- **Intended majors** live in `profiles.intended_major_1/2` (My Profile tab,
  `PROFILE_FIELD_MAP`). Nothing else is needed: the university list a student
  cares about is the list of their applications.
- **Student dashboard / admin dashboard / public drawer / student card** read
  intended majors and per-application universities; the admin search, filter and
  distribution card now work on `applications.university`
  ("Applications by University"), and per-application cards keep using
  `app.university` / `app.major`.
- **Migration `005_drop_profile_university_major.sql`** backfills `major` →
  `intended_major_1` where empty, then drops `profiles.university`,
  `profiles.major` and the dead `profiles.committed_university`. Applied to the
  live project: column count verified 0 leftovers, all 6 profiles kept their
  major as an intended major.
- Deleted a stray empty file named `git` from the repo root.
- `npm test` 50/50 pass, `npm run build` passes, lint unchanged (the 22
  pre-existing `StudentDashboard.jsx` errors are the same as before).

---

## Activities & Experiences — full redesign (UI + Supabase, end to end)

The three old tabs (Volunteering, Internships & Jobs, Projects & Research) are
now **Activities** (one ranked list) + **Projects & Research** (unchanged).
Everything is stored in `public.activities`; nothing is seeded.

**Database — migration `006_activities_redesign.sql`** (`activities_redesign`):
nine fixed categories with a CHECK constraint, `organization_description`
(≤ 250), `long_description` (≤ 350), date/grade-level checks,
`(user_id, sort_order)` index and the atomic `reorder_activities(uuid[])` RPC
(`security invoker`, so the existing owner RLS still applies). RLS untouched.

**UI**
- `src/components/activities/ActivitiesSection.jsx` + `.css` — header,
  category chips with live counts, `n / 10` guidance, 10-row divider note,
  20-activity hard cap, ranked All view with @dnd-kit drag (handle, keyboard,
  dashed gap + floating row), filtered card + sticky panel view, ⋯ menu
  (edit / duplicate / move to top / delete), delete confirm with 6-second
  Undo toast, empty/loading/error states, full-screen sheet under 900 px.
- `src/components/activities/ActivityPanel.jsx` — one panel for add and edit:
  category dropdown, grade chips, segmented Mode/Timing/Pay/Type controls,
  MM/YYYY month inputs with an Ongoing switch, location as one
  "City, Country" field, type-specific Work/Research blocks, description
  fields with copy button, counter, 4 px progress track and paste truncation,
  800 ms autosave ("Saving… → Saved 2 s ago", retry on failure), inline
  validation that blocks bad writes, sticky create footer with 6/6 required
  fields and a discard confirmation.
- `src/utils/activities.js` (+ `activities.test.js`, 16 tests) — pure helpers:
  `computeStatus`, `parseLocation`/`formatLocation`, `monthToDate`/`dateToMonth`
  /`formatMonthInput`/`parseMonthInput`, `hoursHelperText`, `buildMeta`,
  `validateActivity`, `requiredCompleted`, draft ↔ row mapping.
- `src/Services/activitiesApi.js` — the only module touching the table (owner
  scope + write whitelist); `src/hooks/useActivities.js` — optimistic list with
  rollback for create / update / delete+restore / duplicate / reorder.
- Navigation: ACTIVITIES now has two pills; `?tab=activities` keeps the tab in
  the URL, `?type=` / `?id=` keep the filter and the open activity. Old
  `/volunteering`, `/internships`, `/internships-jobs` redirect into the
  filtered list; the retired `volunteering` / `experience` tab keys map to it.

**Tidying**
- Removed the dead legacy Activities form (`SectionModal` branches, old
  `ACTIVITY_TYPES` / `ACTIVITY_FILTER_CHIPS` catalogue, the duplicate activity
  Collection in `AcademicSection`), 112 lines of unused JSX in the dashboard.
- `.gitignore` had a stray copy of `package.json` appended — cleaned.
- `vite.config.js` now binds `0.0.0.0` and accepts proxied preview hosts.

**Verification:** `npm test` 66/66 (10 new helper tests + updated legacy-import
assertions), `npm run build` passes, lint unchanged (the 22 pre-existing
`StudentDashboard.jsx` findings). Applied live: all five new constraints reject
bad rows (invalid category, 351 characters, end before start, grade 13) and the
`reorder_activities` RPC exists as `security invoker` with EXECUTE for
`authenticated`. Live click-through of autosave/drag is left for the user.

---

## Upcoming phases
- **Phase 5:** Documents, Recommendations, Financial Aid, Deadlines calendar (§12–15)
- **Phase 6:** Links & Portfolio, CV export (PDF), Counselor dashboard, supervisor contacts, counselor essay comments (§16–19)
