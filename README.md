# 無蝦米練功房

嘸蝦米（無蝦米）輸入法練習網頁應用，可離線使用，也可安裝到 Mac 與 iPhone 主畫面。

練習紀錄會存在這個裝置的瀏覽器（localStorage），包含累計成績與每天的練習歷程。可到「紀錄」看近 7／30 天的進步圖表，也可匯出／匯入 JSON 備份，方便換裝置。可用「清除紀錄」一次清掉。

## 本機開發

```bash
npm install
npm run dev
```

建置：

```bash
npm run build
npm run preview
```

`vite.config.ts` 使用相對路徑 `base: './'`，可放在子路徑或 GitHub Pages 下運作。

## 安裝

- **iPhone（Safari）**：用 Safari 開啟網站 → 分享 → 加入主畫面。
- **Mac Safari**：開啟網站 → 檔案 → 加入 Dock（或分享選單視版本而定）；部分版本在「檔案」選單可加入主畫面／Dock。
- **Mac Chrome**：開啟網站 → 網址列右側的安裝圖示，或選單「儲存並分享」→「安裝應用程式…」。

## 發佈到 GitHub Pages

這個專案已含 `.github/workflows/pages.yml`（push 到 `main` 時會 `npm ci`、建置，並把 `dist` 佈到 Pages）。

1. 在 GitHub 建立公開 repo `boshiamy-practice`（若名稱已被占用再加後綴）。
2. 把本資料夾推上去：

```bash
git init
git add .
git commit -m "Initial commit: 無蝦米練功房 PWA"
git branch -M main
git remote add origin https://github.com/<你的帳號>/boshiamy-practice.git
git push -u origin main

```

3. 在 repo 的 Settings → Pages，Source 選 GitHub Actions。工作流程跑完後網址會是：

`https://<你的帳號>.github.io/boshiamy-practice/`

也可只上傳 `boshiamy-pwa.zip`（內含建置後的靜態檔）到任何支援 HTTPS 的靜態空間。
