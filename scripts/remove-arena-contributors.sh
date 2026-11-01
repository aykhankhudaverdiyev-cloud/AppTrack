#!/usr/bin/env bash
# ============================================================================
# remove-arena-contributors.sh
# ----------------------------------------------------------------------------
# MƏQSƏD: GitHub "Contributors" siyahısından ARENA hesablarını silmək,
#         YAQUBU (yaqubyaqubov1) isə saxlamaq.
#
# Nə edir:
#   1. Repo-nun müvəqqəti təzə klonunu yaradır (git filter-repo bunu tələb edir)
#   2. git filter-repo ilə tarixçədə YALNIZ metadata dəyişir:
#        a) ARENA SİLİNİR:
#           - arena-ai-coding-agent[bot]-un merge commit-i sahibin adına keçir
#           - "Co-authored-by: arena-agent ..." sətri silinir
#           - merge mesajındakı köhnə arena branch adı təmizlənir
#        b) YAQUB SAXLANILIR:
#           - "Merge remote changes" commit-i (c101505 — Yaqubun PR #1 və #3
#             dəyişikliklərinin main-ə düşdüyü commit) müəllifi
#             yaqubyaqubov1 kimi işarələnir. Committer (Aykhan) olduğu kimi
#             qalır — hər ikisi credit alır.
#      Fayl məzmununa HEÇ BİR dəyişiklik edilmir (tree hash eyni qalır).
#   3. Yoxlama edir — arena qalığı 0 və Yaqub 1 commit olmasa push etmir
#   4. main-i force-push edir, köhnə arena branch-ini silir
#
# Qeydlər:
#   - Tarixçə yenidən yazılır → commit SHA-ları dəyişir (normaldır).
#   - Backup: skript push-dan əvvəl LOCAL "backup-pre-rewrite" tag-i yaradır.
#   - İcradan sonra Contributors siyahısı GitHub keşi yenilənəndə təmizlənir
#     (adətən dərhal, bəzən 24 saata qədər). Yaqubun profilindəki contribution
#     graph-a da bu commit düşəcək.
#
# İşlətmə:  bash scripts/remove-arena-contributors.sh
# ============================================================================

set -euo pipefail

REPO_URL="https://github.com/aykhankhudaverdiyev-cloud/AppTrack.git"
STALE_BRANCH="arena/01a0cfd7-apptrack"
YAQUB_COMMIT="c101505c12689fad64d87bd31425e41e8803f9d5"
WORKDIR="$(mktemp -d)/AppTrack"

echo "==> 1/5 git-filter-repo yoxlanılır..."
if ! command -v git-filter-repo >/dev/null 2>&1; then
  pip install git-filter-repo || pip3 install git-filter-repo
fi

echo "==> 2/5 Təzə clone yaradılır: $WORKDIR"
git clone --quiet "$REPO_URL" "$WORKDIR"
cd "$WORKDIR"
git tag backup-pre-rewrite   # local backup — push EDİLMİR

# Sağlamlıq yoxlaması: Yaqubun commit-i bu klonda olmalıdır
if ! git cat-file -e "$YAQUB_COMMIT" 2>/dev/null; then
  echo "XƏTA: $YAQUB_COMMIT bu repoda tapılmadı — skript köhnəlmiş ola bilər."
  exit 1
fi

echo "==> 3/5 Tarixçə yenidən yazılır (yalnız metadata)..."
git filter-repo --force \
  --commit-callback '
# --- a) ARENA botunu sil: merge commit-i sahibin adına keçir ---
if commit.author_name == b"arena-ai-coding-agent[bot]":
    commit.author_name = b"aykhankhudaverdiyev-cloud"
    commit.author_email = b"297470525+aykhankhudaverdiyev-cloud@users.noreply.github.com"
if commit.committer_name == b"arena-ai-coding-agent[bot]":
    commit.committer_name = b"aykhankhudaverdiyev-cloud"
    commit.committer_email = b"297470525+aykhankhudaverdiyev-cloud@users.noreply.github.com"

# --- b) YAQUBU saxla: onun birləşdirilmiş işini onun adına yaz ---
if commit.original_id == b"'"$YAQUB_COMMIT"'":
    commit.author_name = b"yaqubyaqubov1"
    commit.author_email = b"125134910+yaqubyaqubov1@users.noreply.github.com"
' \
  --message-callback '
import re
# Arena co-author sətrini sil
message = re.sub(rb"\n*Co-authored-by: arena-agent [^\n]*", b"", message)
# Merge mesajındakı köhnə arena branch adını təmizlə
message = message.replace(b"aykhankhudaverdiyev-cloud/arena/01a0cfd7-apptrack", b"feature-branch")
return message
'

echo "==> 4/5 Yoxlama..."
LEFT=$(git log --format='%an|%cn|%B' main | grep -ci arena || true)
COUNT=$(git rev-list --count main)
YAQUB=$(git log --format='%ae' main | grep -c '125134910+yaqubyaqubov1' || true)
echo "    arena qalığı : $LEFT  (0 olmalıdır)"
echo "    yaqub commit : $YAQUB  (1 olmalıdır)"
echo "    commit sayı  : $COUNT  (76 olmalıdır)"
if [ "$LEFT" != "0" ]; then
  echo "XƏTA: tarixçədə hələ arena qalığı var — push dayandırıldı."
  exit 1
fi
if [ "$YAQUB" != "1" ]; then
  echo "XƏTA: Yaqubun commit-i itirildi — push dayandırıldı."
  exit 1
fi

echo "==> 5/5 main force-push edilir..."
git remote add origin "$REPO_URL"   # filter-repo origin remote-u silir
git push --force origin main
# Köhnə arena branch-i hələ remote-da dirsə, sil (contributor-a təsiri yoxdur, təmizlikdir)
git push origin --delete "$STALE_BRANCH" 2>/dev/null || true

echo ""
echo "✅ Hazırdır!"
echo "   - ARENA: Contributors-dan silinəcək (GitHub keşi yenilənəndə)."
echo "   - YAQUB: 'Merge remote changes' commit-i onun adına yazıldı →"
echo "     Contributors-da qalacaq və profilində contribution kimi görünəcək."
echo "   - Vercel avtomatik yenidən deploy edəcək (fayl dəyişikliyi yoxdur)."
echo "   - Local backup: '$WORKDIR' qovluğunda 'backup-pre-rewrite' tag-i."
