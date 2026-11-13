# Supabase Migrations — Phase 0 (v2, backend-aware)

Bu qovluqdakı faylları **Supabase Dashboard → SQL Editor**-da yuxarıdan aşağıya **bu sırayla** işə sal:

| Sıra | Fayl | Nə edir |
|---|---|---|
| 1 | `001_schema_extensions.sql` | 33 yeni cədvəli yenidən yaradır (drop + create), `profiles`/`applications`-ı genişləndirir |
| 2 | `002_rls_policies.sql` | Yalnız YENİ cədvəllərdə RLS: owner/counselor/admin |
| 3 | `003_storage.sql` | `student-documents` private qalır + owner-qovluq siyasətləri (`avatars` toxunulmazdır) |
| 4 | `004_seed_universities.sql` | ~110 universitet seed |
| 5 | `005_drop_profile_university_major.sql` | `profiles.university` / `major` / `committed_university` sütunlarını silir (əvvəl `major` → `intended_major_1` köçürülür) |

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
