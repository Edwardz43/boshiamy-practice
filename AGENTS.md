# 嘸蝦米練功房（boshiamy-practice）專案規則

本專案是 Ed 的個人嘸蝦米輸入法練習 PWA，透過 GitHub Pages（GitHub Actions 自動建置）發佈於 `https://edwardz43.github.io/boshiamy-practice/`。

## 溝通與隱私（公開 Repo 紅線）

- 使用**台灣用語的正體中文**，語氣溫暖、簡短。
- 本 repo 為**公開倉庫**：絕不在程式碼、檔案或 git commit 中寫入個人法定姓名、私人電子郵件地址、電話或任何密鑰。
- 本 repo 的本地 git author 須維持 `Ed43 <25794152+Edwardz43@users.noreply.github.com>`（不可誤用全域個人信箱）。
- 幫 Ed 查嘸蝦米字碼時，若有簡體寫法與其字碼請一併列出。

## 開發、測試與資安規範

- **CSP 保護**：`index.html` 設有嚴格 meta CSP（`connect-src` 目前僅開放 `'self'` 與 `https://zh.wikipedia.org`）；新增外部連線前須先審慎更新 CSP，並以 `test-csp.mjs` 驗證零違規。
- **匯入備份防護**：`src/historyLogic.ts` 維持大小上限（2 MB）、鍵數／鍵長限制與原型污染防護（略過 `__proto__` 等鍵）。
- **授權與資料檔**：`public/liu-table.json`、`public/opencc-chars.json` 與 `public/opencc-LICENSE.txt`（Apache-2.0）不可刪除；重建繁簡表請用 `node scripts/build-opencc.mjs`。
- **發佈前驗證**：
  1. 建置：`npm run build`（含 `tsc --noEmit` 與 `vite build`）。
  2. 邏輯測試：`node test-lookup.mjs`、`node test-history.mjs`。
  3. UI／CSP 測試：先啟動 `npx vite preview --host 127.0.0.1 --port 4180 --strictPort`，再執行 `node test-csp.mjs`、`node test-lookup-ui.mjs`、`node test-history-ui.mjs`、`node test-article.mjs`。

## 分支與部署規則

- `main` 受 `protect-main` 保護：禁止強制推送（force-push）與刪除分支，一律正常 fast-forward commit 推送。
- 推送至 `main` 後由 `.github/workflows/pages.yml` 自動 `npm ci`、`npm run build` 並部署至 GitHub Pages；切勿再手動把 `dist/` 覆蓋進 `main` 根目錄。
- 舊版純 `dist/` 最後狀態已保留於 git tag `legacy-dist-69777e3`。
