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

### Education page (rebuild)
- **UI:** `src/components/academic/EducationSection.jsx` (+ `.css`) is the page
  container (`SectionPage` with `className="edu-page"`), filter chips, the entry
  cards and the empty "add another" card. `EducationPanel.jsx`, `EducationField.jsx`,
  `EducationInputs.jsx` (country select + month picker) and `GradeTable.jsx` make up
  the right-hand panel: BASICS · ACADEMIC RECORD · GRADES · COUNSELOR · PROOF.
- **Data:** `src/Services/educationApi.js` (whitelisted columns, owner-scoped,
  notifies the dashboard's realtime channel) and `src/hooks/useEducation.js`
  (optimistic updates with rollback). Grade rows are synced through the existing
  `syncGradeRows()` in `ProfileServiceV2.js`, so clearing a cell deletes its row.
- **Pure rules:** `src/utils/education.js` — draft ⇄ row, `entryMeta()`
  ("Sep 2023 – Jun 2027 · Grade 11"), filter counts, validation, and the
  subject ⇄ `grade_rows` conversion. Covered by `education.test.js`.
- **Design review without a session:** `npm run dev:education` serves
  `index.education-preview.html` through `vite.preview.config.js`, which aliases
  the API and the Supabase client to the offline stubs in `src/preview/`.
  This entry is not part of `npm run build` and is not linked from the app.

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
