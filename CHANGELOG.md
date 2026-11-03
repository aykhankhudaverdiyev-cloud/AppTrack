# AppTrack — Changelog

Rebuild driven by the college-counselor specification (20 sections). Delivered in phases.

---

## Phase 2 — Essays (§10)
- New **Essays** tab (Admissions group): list with status filter, over-limit warning, delete with confirmation.
- Editor: autosave, type presets (Common App 650/250, UC PIQ 350, UCAS 4000 chars...), live word/char counter, prompt, private notes.
- Versions: manual "Save version", auto snapshot on Counselor review / Final / Submitted, view + restore (current text is snapshotted first).
- Counselor comments shown to the student (mark resolved/reopen); link essays to applications with a per-university AI-rules note.
- Essays stay private (no visibility); service functions live in `ProfileServiceV2.js`. No schema changes.
- Not yet: counselor-side commenting UI (Phase 6), share with specific user, Overview widgets, E.164 phone, "Request change".

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

## Upcoming phases
- **Phase 2:** Essays (highest priority — versions, counters, counselor comments)
- **Phase 3:** Applications rebuild (ranked choices, round rules, checklist + progress %)
- **Phase 4:** Education, Test Scores, Honors, Activities, Projects, Publications
- **Phase 5:** Documents, Recommendations, Financial Aid, Deadlines calendar
- **Phase 6:** Links & Portfolio, CV export (PDF), Counselor dashboard
