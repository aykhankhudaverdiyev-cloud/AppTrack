# AppTrack — Dəyişiklik Jurnalı

Konsellor spesifikasiyası (20 bölmə) əsasında yenidən qurulma. Fazalarla icra olunur.

---

## Faza 0 — Təməl: DB sxemi, RLS, timezone, ortaq form komponentləri

**Status:** hazır · **Tarix:** 2026-11-01

### Nə dəyişdi, harada

#### Supabase migrasiyaları (yeni — `supabase/migrations/`)
| Fayl | Məzmun |
|---|---|
| `001_schema_extensions.sql` | **33 yeni cədvəl**: universities, profile_private, parents, education_entries, grade_rows, test_attempts, test_section_scores, score_sending, honors, activities, projects, publications, application_choices, application_deadlines, application_requirements, interviews, supervisor_contacts, essays, essay_versions, essay_comments, essay_shares, application_essays, documents, document_versions, document_links, recommenders, recommendation_assignments, financial_profile, aid_forms, scholarships, links, portfolio_items, reminders. `profiles` + `applications` genişləndirildi (55+ yeni sütun: struktur adlar, məqsədlər, portal, fee, fit, decision, aid). `updated_at` trigger-i, indekslər. |
| `002_rls_policies.sql` | **Bütün cədvəllərdə RLS**: owner (tam hüquq) + counselor (yalnız təyin olunmuş tələbələr, `profiles.counselor_id` üzərindən) + admin. `public_directory` view — public sahələrin yeganə qapısı; şəxsi sütunlar (passport, DOB, ünvanlar) view-a **daxil deyil**. |
| `003_storage.sql` | `student-documents` və `avatars` bucket-ləri **məcburi private**; owner-qovluq siyasəti (`{user_id}/...`), counselor üçün read-only, signed URL (1 saat). |
| `004_seed_universities.sql` | ~110 universitet seed (AZ, TR, US, UK, CA, HK, SG, TW, KR, EU) — application avtokomplekti üçün. |
| `README.md` | SQL Editor-da işə salma təlimatları (sıra + yoxlama). |

#### Gizlət memarı (Bölmə 0.6 qəbul meyarı)
- Şəxsi data (DOĞ, pasport, ünvan, ev təsərrüfatı) ayrıca **`profile_private`** cədvəlindədir — public `profiles` sorğusundan fiziki olaraq sıza bilməz.
- Sənədlərin həssas kateqoriyaları (passport, transcript, bank statement, recommendation copy...) üçün **CHECK constraint**: `is_public = true` ola bilməz — birbaşa API çağırışıyla belə.
- Essays-də `visibility` sütunu ümumiyyətlə yoxdur: paylaşma yalnız açıq `essay_shares` sətirləri ilə (müəyyən istifadəçiyə).
- Portallara heç vaxt şifrə saxlanmır (yalnız URL + login email + applicant ID) — Bölmə 0.7.

#### Timezone sistemi (yeni — `src/utils/timezone.js`)
- `zonedTimeToUtc('2027-01-05','12:00','Asia/Hong_Kong')` → dəqiq UTC anı (DST daxil, iki keçidli ofset həlli)
- `describeDeadline()` → lokal vaxt + orijinal vaxt + GMT etiketi + geri sayım + gün sürüşməsi (ABŞ 23:59 → Bakıda səhər = `dayShift: 1`)
- `suggestReminderTimes()` → 30/14/7/3/1 gün və gün-östə xatırlatma anları
- **12/12 test keçir** (`src/utils/timezone.test.js`, `npm test`): qəbul meyarı — HK 12:00 → Bakı 08:00, Nyu-York 23:59 → Bakı 08:59 (ertəsi gün) ✅

#### Ortaq form komponentləri (yeni — `src/components/forms/`)
| Komponent | Məqsəd | Spesifikasiya |
|---|---|---|
| `Field` | Etiketli, xətalı, izahlı sahə sarğısı (aria-*) | #9, #10 |
| `ValidatedInput` / `ValidatedSelect` | Inline xəta + QAYDA izahı ("SAT 200–800, 10 addımla") | #9 |
| `CharWordCounter` | Simvol **və** söz sayğacı birlikdə; limit tipi vurğulanır; limit aşımı xəbərdarlığı | #4 |
| `MonthYearPicker` | Ay+il seçimi (strukturlaşdırılmış tarixlər) | #3 |
| `ConfirmDialog` | Hər silmə üçün təsdiq (Escape, fokus idarəsi) | #8 |
| `SortableList` | Drag-to-reorder + klaviatura ↑↓ (mobil uyğun) | #8, #10 |
| `useAutosave` / `useUnsavedGuard` | Debounce-lu avtosaxla + bağlama xəbərdarlığı | #8 |
| `src/constants/activityTypes.js` | Common App 27 kateqoriya + filtrlər çipləri (Volunteering, Work & Internships...) + CA/UC limitləri | #1, Bölmə 7 |

Stil: mövcud dizayn dili qorunub — bənövşəyi qradiyent (`#7c3aed → #6d28d9`), yumşaq kölgələr, kart radiusu, mobil 16px input (iOS zoom qorunması).

#### Digər
- `package.json`: `npm test` əmri əlavə olundu (node:test, dependency yoxdur).
- Saytın görünüşündə **heç bir dəyişiklik yoxdur** — Faza 0 tamamilə təməldir; UI Faza 1-dən başlayaraq qoşulur.

### Qəbul meyarlarının vəziyyəti
| Meyar | Status |
|---|---|
| Modal sahələri + sayğacılar | 🟡 toolkit hazır — modal-lar fazalarda qurulur |
| Profil completion boş profildə düzgün | ⬜ Faza 1 |
| Asia/Hong_Kong → Asia/Baku düzgün lokal vaxt | ✅ 12/12 test |
| Həssas kateqoriyalar API ilə belə public ola bilməz | ✅ CHECK + RLS + yox `public_directory` |

---

## Gələcək fazalar
- **Faza 1:** My Profile yenidən qurulması + Profile completion bug fix + Overview stat kartları
- **Faza 2:** Essays (ən yüksək prioritet — versiyalar, sayğacılar, counselor şərhləri)
- **Faza 3:** Applications rebuild (ranked choices, round qaydaları, checklist + progress %)
- **Faza 4:** Education, Test Scores, Honors, Activities, Projects, Publications
- **Faza 5:** Documents, Recommendations, Financial Aid, Deadlines təqvimi
- **Faza 6:** Links & Portfolio, CV export (PDF), Counselor dashboard
