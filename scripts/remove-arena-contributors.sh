#!/usr/bin/env bash
# ============================================================================
# remove-arena-contributors.sh
# ----------------------------------------------------------------------------
# "arena" hesablarını (arena-agent və arena-ai-coding-agent[bot]) GitHub
# Contributors siyahısından silir.
#
# Nə edir:
#   1. Repo-nun müvəqqəti təzə klonunu yaradır (git filter-repo bunu tələb edir)
#   2. git filter-repo ilə tarixçədə YALNIZ metadata dəyişir:
#        - arena-ai-coding-agent[bot]-un merge commit-i SƏNİN adına keçir
#        - "Co-authored-by: arena-agent ..." sətri silinir
#        - merge mesajındakı köhnə branch adı təmizlənir
#      Fayl məzmununa HEÇ BİR dəyişiklik edilmir (tree hash eyni qalır).
#   3. Yoxlama edir — arena qalığı 0 olmasa push etmir
#   4. main-i force-push edir, köhnə arena branch-ini silir
#
# Qeydlər:
#   - Bu əməliyyat main tarixçəsini yenidən yazır → commit SHA-ları dəyişir.
#   - Backup: skript push-dan əvvəl LOCAL "backup-pre-rewrite" tag-i yaradır.
#   - İcradan sonra Contributors siyahısı bir neçə dəqiqə ~ 24 saat ərzində
#     yenilənir (GitHub keşi).
#
# İşlətmə:  bash scripts/remove-arena-contributors.sh
# ============================================================================

set -euo pipefail

REPO_URL="https://github.com/aykhankhudaverdiyev-cloud/AppTrack.git"
STALE_BRANCH="arena/01a0cfd7-apptrack"
WORKDIR="$(mktemp -d)/AppTrack"

echo "==> 1/5 git-filter-repo yoxlanılır..."
if ! command -v git-filter-repo >/dev/null 2>&1; then
  pip install git-filter-repo || pip3 install git-filter-repo
fi

echo "==> 2/5 Təzə clone yaradılır: $WORKDIR"
git clone --quiet "$REPO_URL" "$WORKDIR"
cd "$WORKDIR"
git tag backup-pre-rewrite   # local backup — push EDİLMİR

echo "==> 3/5 Tarixçə yenidən yazılır (yalnız metadata)..."
git filter-repo --force \
  --commit-callback '
if commit.author_name == b"arena-ai-coding-agent[bot]":
    commit.author_name = b"aykhankhudaverdiyev-cloud"
    commit.author_email = b"297470525+aykhankhudaverdiyev-cloud@users.noreply.github.com"
if commit.committer_name == b"arena-ai-coding-agent[bot]":
    commit.committer_name = b"aykhankhudaverdiyev-cloud"
    commit.committer_email = b"297470525+aykhankhudaverdiyev-cloud@users.noreply.github.com"
' \
  --message-callback '
import re
message = re.sub(rb"\n*Co-authored-by: arena-agent [^\n]*", b"", message)
message = message.replace(b"aykhankhudaverdiyev-cloud/arena/01a0cfd7-apptrack", b"feature-branch")
return message
'

echo "==> 4/5 Yoxlama..."
LEFT=$(git log --format='%an|%cn|%B' main | grep -ci arena || true)
COUNT=$(git rev-list --count main)
echo "    arena qalığı : $LEFT  (0 olmalıdır)"
echo "    commit sayı  : $COUNT  (76 olmalıdır)"
if [ "$LEFT" != "0" ]; then
  echo "XƏTA: tarixçədə hələ arena qalığı var — push dayandırıldı."
  exit 1
fi

echo "==> 5/5 main force-push edilir..."
git remote add origin "$REPO_URL"   # filter-repo origin remote-u silir
git push --force origin main
# Köhnə arena branch-i hələ remote-da dirsə, sil (contributor-a təsiri yoxdur, təmizlikdir)
git push origin --delete "$STALE_BRANCH" 2>/dev/null || true

echo ""
echo "✅ Hazırdır!"
echo "   - GitHub 'Contributors' siyahısı GitHub keşi yenilənəndə təmizlənəcək"
echo "     (adətən dərhal, bəzən 24 saata qədər)."
echo "   - Vercel avtomatik yenidən deploy edəcək (fayl dəyişikliyi yoxdur)."
echo "   - Local backup: '$WORKDIR' qovluğunda 'backup-pre-rewrite' tag-i."
