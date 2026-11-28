#!/usr/bin/env bash
set -euo pipefail

# 優先順序：
# 1. 使用者明確設定的 BOSHIAMY_CONTEXT_DIR（不建議將含個人帳號的路徑寫入公開 repo）
# 2. 自動偵測本機掛載的 Google Drive（支援繁中「我的雲端硬碟」與英文「My Drive」）→ Gemini-Context
# 3. 回退到專案根目錄下的 .context（已加入 .gitignore）

detect_gdrive_dir() {
  local cloud_root="$HOME/Library/CloudStorage"
  [ -d "$cloud_root" ] || return 1
  local drive_dir sub
  for drive_dir in "$cloud_root"/GoogleDrive-*; do
    [ -d "$drive_dir" ] || continue
    for sub in "我的雲端硬碟" "My Drive"; do
      if [ -d "$drive_dir/$sub" ]; then
        printf '%s\n' "$drive_dir/$sub/Gemini-Context"
        return 0
      fi
    done
  done
  return 1
}

if [ -n "${BOSHIAMY_CONTEXT_DIR:-}" ]; then
  OUT_DIR="$BOSHIAMY_CONTEXT_DIR"
elif GDRIVE_DIR="$(detect_gdrive_dir)"; then
  OUT_DIR="$GDRIVE_DIR"
else
  OUT_DIR=".context"
fi

OUT_FILE="${OUT_DIR%/}/boshiamy-context.md"

mkdir -p "$OUT_DIR"
npx --yes repomix --style markdown --output "$OUT_FILE"

echo ""
echo "Context snapshot written to: $OUT_FILE"
ls -lh "$OUT_FILE"
