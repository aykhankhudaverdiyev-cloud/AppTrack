# Supabase Migrations — Phase 0

Bu qovluqdakı faylları **Supabase Dashboard → SQL Editor**-da yuxarıdan aşağıya **bu sırayla** işə sal:

| Sıra | Fayl | Nə edir |
|---|---|---|
| 1 | `001_schema_extensions.sql` | 30+ yeni cədvəl, profiles/applications genişlənmələri, trigger və indekslər |
| 2 | `002_rls_policies.sql` | Row Level Security: owner/counselor/admin siyasətləri, public directory view |
| 3 | `003_storage.sql` | Private bucket siyasətləri (owner-qovluq modeli) |
| 4 | `004_seed_universities.sql` | ~110 universitet seed (avtokomplekt üçün) |

## Addımlar

1. Supabase Dashboard-u aç → layihəni seç
2. Sol menyu → **SQL Editor** → **New query**
3. Faylın bütün məzmununu kopyala-yapışdır → **Run**
4. "Success. No rows returned" görəcəksən — OK ✅
5. Növbəti faylla davam et

## Yoxlama (hər ikisi success-dən sonra)

- **Table Editor** → yenilə → yeni cədvəllər görünür:
  `universities, profile_private, parents, education_entries, grade_rows, test_attempts, test_section_scores, score_sending, honors, activities, projects, publications, application_choices, application_deadlines, application_requirements, interviews, supervisor_contacts, essays, essay_versions, essay_comments, essay_shares, application_essays, documents, document_versions, document_links, recommenders, recommendation_assignments, financial_profile, aid_forms, scholarships, links, portfolio_items, reminders`
- SQL Editor-da test: `select name, country from universities limit 5;` → 5 sətir qayıtmalıdır

## Qeydlər

- Bütün fayllar **idempotentdir** — təkrar işə salsaq xəta vermir.
- Mövcud cədvəllər (`profiles`, `applications`, `application_documents`, `licenses`, `license_media`) **yalnız genişləndirilir**, məzmunu toxunulmazdır.
- `profiles` cədvəlinə `counselor_id` sütunu əlavə olunur — counselor-ın tələbəyə RLS-based girişi bunun üzərindən qurulur. Müvəqqəti olaraq counselor təyin etmək üçün: SQL Editor-da `update profiles set counselor_id = '<counselor_user_id>' where id = '<student_user_id>';`
- Yeni sütunlar UI-yə Faza 1+ da daxil olacaq; bu migrasiya hazırkı saytın işinə **heç bir maneə yaratmır**.
