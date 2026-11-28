#!/usr/bin/env bash
set -euo pipefail

# 預設輸出到專案根目錄下的 .context/boshiamy-context.md（已加入 .gitignore）。
# 待本機掛載 Google Drive 後，可透過環境變數指定輸出資料夾，避免在公開 repo 寫入個人帳號路徑，例如：
#   export BOSHIAMY_CONTEXT_DIR="$HOME/Library/CloudStorage/GoogleDrive-<帳號>/My Drive/Gemini-Context"
#   npm run sync-context

OUT_DIR="${BOSHIAMY_CONTEXT_DIR:-.context}"
OUT_FILE="${OUT_DIR%/}/boshiamy-context.md"

mkdir -p "$OUT_DIR"
npx --yes repomix --style markdown --output "$OUT_FILE"

echo ""
echo "Context snapshot written to: $OUT_FILE"
ls -lh "$OUT_FILE"
