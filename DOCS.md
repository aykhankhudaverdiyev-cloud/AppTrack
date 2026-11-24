# AppTrack: Developer Documentation

This project uses **React**, **Vite**, and **Supabase**. This guide will help you understand the codebase and architectural decisions.

## 1. Project Architecture
*   `src/pages/`: Contains the main application views (Dashboard, Login, etc.).
*   `src/components/`: Reusable UI modules.
*   `src/store/`: The "Brain" of the app. `studentsStore.js` is responsible for fetching, merging, and normalizing data from multiple Supabase tables.
*   `src/Services/`: API interaction layer.
*   `src/context/`: Handles global Auth state.
*   `src/lib/`: Database client initialization.

## 2. Important Logic
### Authentication & Role System
- `AuthContext.jsx` manages the global session.
- `App.jsx` handles routing. The `RootRedirect` function checks the user's role (`student` vs `admin`) and directs them accordingly.
- `RoleRoute.jsx` acts as a route guard.

### File Storage & Security
- Files are stored in Supabase `student-documents` bucket.
- **Privacy:** Files are private by default. Access is managed via `createSignedUrl` (1-hour expiration).
- **Security:** RLS (Row Level Security) policies are enforced in Supabase to ensure users can only access files they are authorized to see.

### Real-time Sync
- The application uses Supabase `channels` (`postgres_changes`) to listen for database events. Whenever data in `profiles` or `applications` tables changes, the store automatically reloads the data.

### Education page
- **UI:** `src/components/academic/EducationSection.jsx` (+ `.css`) is the page
  container (`SectionPage` with `className="edu-page"`), filter chips, the entry
  cards and the empty "add another" card. `EducationPanel.jsx` +
  `GradeTable.jsx` make up the right-hand panel: BASICS · ACADEMIC RECORD ·
  GRADES · COUNSELOR · PROOF.
- **Data:** `src/Services/educationApi.js` (whitelisted columns, owner-scoped,
  notifies the dashboard's realtime channel) and `src/hooks/useEducation.js`
  (optimistic updates with rollback).
- **Grades:** one row per subject × grade level × semester in `public.grade_rows`,
  saved through the `save_grade_rows(entry_id, jsonb)` RPC (delete + insert in one
  transaction, 800 ms debounce). The columns come from
  `education_entries.final_grade_level` (10–14), `Show semesters` splits them into
  S1 · S2 · Final.
- **Pure rules:** `src/utils/education.js` — draft ⇄ row, `entryMeta()`
  ("Sep 2023 – Jun 2027 · Grade 11"), filter counts, validation, grade scale
  checks, subject suggestions and the subject ⇄ `grade_rows` conversion.
  Covered by `education.test.js`.

### Proof files (Education, Test Scores, Honors, Projects, Documents)
- **One table:** `public.item_documents(section, item_id, document_id)` links a
  `document_files` row to an item. Sections: `education`, `test`, `honor`,
  `project`. RLS mirrors `document_files` (owner / admin / counselor-read).
- **One UI:** `src/components/section/ProofBlock.jsx` is the PROOF section of every
  panel (list, Upload, Choose from Documents, View, Remove, ⋯ → Delete file…).
  `src/Services/documentsApi.js` is the only module that talks to the two tables
  and the `student-documents` bucket.
- **Delete anywhere:** `document_usage(document_id)` says where a file is used and
  `delete_document(document_id)` removes the links, the row and returns the storage
  path (the client removes the object). Same dialog on the Documents tab
  (`src/components/DocumentsPage.jsx`).
- The old single-document columns (`education_entries.transcript_document_id`,
  `test_attempts.report_document_id`, `honors.certificate_document_id`,
  `projects.report_document_id`) are no longer read or written; migration 012 copied
  their values into `item_documents` and
  `supabase/scripts/backfill_item_documents.sql` can re-run that copy safely
  (`on conflict do nothing`).

### Shared controls
- **Dates:** `src/components/section/DatePicker.jsx` (month + day). Typing
  "09/2023" / "Sep 2023" works, a month is stored as its first day, ✕ clears, the
  popover flips above/below and is portalled so it is never clipped.
- **Text inputs:** 44 px high, 12–14 px padding, 15 px text, 10 px radius, outline
  focus ring (never clipped). `TextAreaField` grows from 3 to 12 lines and then
  scrolls; `Field` reserves the helper/error line so panels never jump.

## 3. Contributing
1. **Adding a Feature:** Create a page in `src/pages/`.
2. **Adding Data:** If a new table is needed, update the `getStudents` or `loadStudents` function in `studentsStore.js`.
3. **Best Practices:**
   - Keep logic in `Services/` or `store/`.
   - Maintain JSDoc comments for new functions.
## Supabase migration notes

# Supabase Migrations — Phase 0 (v2, backend-aware)

Bu qovluqdakı faylları **Supabase Dashboard → SQL Editor**-da yuxarıdan aşağıya **bu sırayla** işə sal:

| Sıra | Fayl | Nə edir |
|---|---|---|
| 1 | `001_schema_extensions.sql` | 33 yeni cədvəli yenidən yaradır (drop + create), `profiles`/`applications`-ı genişləndirir |
| 2 | `002_rls_policies.sql` | Yalnız YENİ cədvəllərdə RLS: owner/counselor/admin |
| 3 | `003_storage.sql` | `student-documents` private qalır + owner-qovluq siyasətləri (`avatars` toxunulmazdır) |
| 4 | `004_seed_universities.sql` | ~110 universitet seed |
| 5 | `005_drop_profile_university_major.sql` | `profiles.university` / `major` / `committed_university` sütunlarını silir (əvvəl `major` → `intended_major_1` köçürülür) |
| 6 | `006_activities_redesign.sql` | `activities` cədvəlini yekunlaşdırır: 9 sabit kateqoriya, `organization_description` (≤250), `long_description` (≤350), tarix/grade CHECK-ləri, `(user_id, sort_order)` indeksi, `reorder_activities()` RPC (security invoker) |
| 7 | `007_projects_redesign.sql` | `projects` səhifəsini yekunlaşdırır: `build_summary` sütunu, `status ∈ {in_progress, live, paused}`, `role_type ∈ {solo, team_lead, team_member}`, uzunluq CHECK-ləri (problem/result 300, summary 200, ≤12 texnologiya), `(user_id, created_at)` indeksi. Mövcud sətirlər avtomatik çevrilir |
| 8 | `010_education_redesign.sql` | `education_entries.transcript_document_id` (→ `document_files`, `on delete set null`) + `assert_document_owner()` trigger-i + indeks. Education səhifəsinin PROOF bölməsi üçün. Heç bir sətir dəyişmir, RLS toxunulmur |

## Vacib zəmanətlər (v2)

- **Köhnə cədvəllərə toxunulmur:** `profiles, applications, application_documents, licenses, license_media, visibility_requests` (app-in bugünkü 6 cədvəli) + köhnə qalıqlar (`students, education, recommendations, documents, profile2s, user_roles, admin_notes, change_requests, notifications, notification_settings`).
- Yeni fayl kitabxanası cədvəli köhnə `documents` ilə toqquşmaması üçün **`document_files`** adlanır.
- 001 başda yalnız öz 33 yeni cədvəlini silir (hamısı boşdur) — başqa heç nə.
- Admin təsdiqli görünürlük axını (visibility_requests) olduğu kimi işləməyə davam edir.

## Yoxlama (hamısı bitəndən sonra)

```sql
select count(*) from universities;            -- 110
select count(*) from information_schema.tables
 where table_schema='public'
   and table_name in ('document_files','essays','activities','test_attempts');  -- 4
```
