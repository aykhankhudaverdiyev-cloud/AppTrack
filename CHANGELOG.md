# AppTrack — Changelog

Rebuild driven by the college-counselor specification (20 sections). Delivered in phases.

---

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

## Upcoming phases
- **Phase 1:** My Profile rebuild + profile-completion fix + Overview stat cards
- **Phase 2:** Essays (highest priority — versions, counters, counselor comments)
- **Phase 3:** Applications rebuild (ranked choices, round rules, checklist + progress %)
- **Phase 4:** Education, Test Scores, Honors, Activities, Projects, Publications
- **Phase 5:** Documents, Recommendations, Financial Aid, Deadlines calendar
- **Phase 6:** Links & Portfolio, CV export (PDF), Counselor dashboard
