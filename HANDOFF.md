# HANDOFF — AppTrack Rebuild Status

> Read this first in every new session. It is the single source of truth for
> where the counselor-spec rebuild stands and what comes next.

## Current state (2026-11-01)

**Phase 0 — COMPLETE.** All 4 migrations ran successfully on the live Supabase
project (`select count(*) from universities` → 123). No visual change to the
site — Phase 0 is pure foundation.

| Piece | Status | Where |
|---|---|---|
| 33 new tables (+ FKs ordered, drop-guard recreate) | ✅ live in DB | `supabase/migrations/001_schema_extensions.sql` |
| RLS on the 33 new tables (owner/counselor/admin) | ✅ live | `supabase/migrations/002_rls_policies.sql` |
| Storage policies: `student-documents` private, `avatars` untouched (public, used via getPublicUrl) | ✅ live | `supabase/migrations/003_storage.sql` |
| Universities seed (123 rows) | ✅ live | `supabase/migrations/004_seed_universities.sql` |
| Timezone utils (HK 12:00 → Baku 08:00, NY 23:59 → Baku 08:59 next day) | ✅ 12/12 tests | `src/utils/timezone.js` + `.test.js` |
| Shared form toolkit (CharWordCounter, ValidatedInput/Select, Field, MonthYearPicker, ConfirmDialog, SortableList, useAutosave) | ✅ ready, not yet wired into pages | `src/components/forms/`, `src/hooks/useAutosave.js` |
| Common App constants (27 activity types, filter chips, CA/UC limits) | ✅ ready | `src/constants/activityTypes.js` |
| Changelog | ✅ | `CHANGELOG.md` |

## Critical repo facts (do not break these)

1. **Live legacy tables the app depends on today** (never drop/alter without
   the user's OK): `profiles, applications, application_documents, licenses,
   license_media, visibility_requests`. Stale leftovers (untouched, ignored):
   `students, education, recommendations, documents, profile2s, user_roles,
   admin_notes, change_requests, notifications, notification_settings`.
2. **`document_files`** is the new document-library table (NOT `documents` —
   name collision with a legacy table caused a failed run once).
3. **Visibility flow today is admin-approved**: student requests public/private
   → row in `visibility_requests` → admin approve/decline flips the value.
   This flow must keep working until the user decides otherwise.
4. **`avatars` bucket is PUBLIC by design** — avatars render via
   `getPublicUrl()`. Do not force it private.
5. **RLS counselor anchor**: `profiles.counselor_id` (new uuid column, nullable).
   The legacy `assigned_counselor` text column stays as-is.
6. **Legacy-table RLS + `public_directory` view are DEFERRED** to a later phase
   (together), so today's admin dashboard, realtime channels and public
   explore keep working.

## Standing rules (user-mandated)

- **All UI strings in ENGLISH** (the site is English; counters, errors,
  dialogs, calendar months included). Default locale en-GB.
- **NO arena co-author trailers in commits.** The sandbox installs a
  `.git/hooks/commit-msg` hook that appends
  `Co-authored-by: arena-agent <...>` to every commit. Neutralize it at
  session start:
  `printf '#!/bin/sh\nexit 0\n' > .git/hooks/commit-msg`
  Then verify with `git log -1 --format=%B | grep -ci arena` → must be 0
  before every push. The user rebuilt main history once specifically to
  remove these (see `scripts/remove-arena-contributors.sh`).
- **The USER merges PRs** (Squash and merge on GitHub). Never merge for them —
  a bot-merged PR is what put arena into contributors last time.
- UI must keep the existing style: cards, purple gradient (#7c3aed → #6d28d9),
  emoji icons, empty states.
- Privacy: sensitive data (passport, DOB, addresses, household, transcripts,
  score reports, recommendation letters, essays) is PRIVATE by default and
  cannot be made public (CHECK constraints + RLS + no public path). Showcase
  items (CV, awards, portfolio, projects, links) may be toggled public.
- Portal passwords are never stored (URL + login email + applicant ID only).

## Next: Phase 1 (approved plan order)

1. **My Profile rebuild** (spec §3): passport-accurate names (given/middle/
   family/preferred/passport/native), private personal data (DOB, citizenship,
   passport + 12-month expiry warning, addresses), gender options + pronouns,
   contact (country code + E.164 phone), languages with proficiency,
   first-generation flag, household, parents/guardians (2+1), goals (level,
   start term, majors, aid, gap year), graduate-only block (degree, work exp,
   research interests, ORCID/Scholar/LinkedIn). DB columns already exist.
2. **Profile completion fix** (spec §2): weighted, level-aware
   (Bachelor: Profile 20 / Education 25 / Tests 15 / Honors 10 / Activities 20
   / Recommenders 10; Master/PhD variant listed in spec). Clicking the bar
   lists missing items with links.
3. **Overview stat cards** (spec §2): next deadline (countdown, local+original
   tz), applications submitted/total, essays final/required, missing documents,
   recommendations received/needed, profile completion. "Counselor" term
   everywhere (no "Mentor"). Committed university only after a Committed offer.
4. Upcoming deadlines (30d), application pipeline counts, recent activity
   widgets.

Then: Phase 2 Essays (§10, highest priority) → Phase 3 Applications (§11) →
Phase 4 libraries (§4-9) → Phase 5 Docs/Recs/Aid/Deadlines (§12-15) →
Phase 6 Links/Portfolio/CV/Counselor dashboard (§16-19).

## How to verify the site after SQL work

Login, applications, licenses, admin approval flow must all still work —
migrations are additive; legacy tables untouched. The dev server can be run
with `npm run dev`; tests: `npm test` (12 timezone tests); lint the new code:
`npx eslint src/components/forms src/hooks src/utils src/constants`.
