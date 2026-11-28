# 嘸蝦米練功房（boshiamy-practice）架構說明

本專案為純前端離線可用 PWA，協助練習嘸蝦米（無蝦米）輸入法，發佈於 GitHub Pages（`https://edwardz43.github.io/boshiamy-practice/`）。

---

## 1. 技術棧、開發環境與部署指令

- **核心框架**：React 19 + TypeScript 5.7 + Vite 6（`base: "./"`，支援子路徑部署）
- **PWA 引擎**：`vite-plugin-pwa` 0.21（Workbox `autoUpdate`，產出 `sw.js`）
- **Node 版本**：Node.js 22（對應 GitHub Actions `pages.yml`）
- **測試工具**：`esbuild`（直接打包純 TS 邏輯以 `node` 單元測試）+ `playwright-core`（Chromium UI / RWD / CSP 測試）
- **無後端、無外部追蹤**：資料全部存於瀏覽器 `localStorage`；唯一外部連線為文章練習呼叫繁體維基百科隨機條目 API（`https://zh.wikipedia.org`）。

### 常用指令

```bash
# 本機開發
npm install
npm run dev

# 型別檢查 + 正式建置（產出 dist/ 與 dist/.nojekyll）
npm run build

# 本機預覽（UI / CSP 測試使用 4180 port）
npx vite preview --host 127.0.0.1 --port 4180 --strictPort

# 邏輯單元測試
node test-lookup.mjs
node test-short.mjs
node test-history.mjs
node test-simplified.mjs
node test-draw.mjs
node test-wordbook-phrases.mjs
node test-weakness.mjs

# UI / CSP / RWD 測試（需先啟動上方 preview 伺服器）
node test-csp.mjs
node test-lookup-ui.mjs
node test-history-ui.mjs
node test-article.mjs
node test-short-ui.mjs
node test-theme-ui.mjs
node test-simplified-ui.mjs
node test-wordbook-phrases-ui.mjs
node test-rwd-ui.mjs
node test-weakness-ui.mjs

# 重建繁簡字元對照表（由 data-src/ 產出 public/opencc-chars.json）
node scripts/build-opencc.mjs

# 打包程式碼快照（供 Gemini App 規劃用）
npm run sync-context
```

### 部署至 GitHub Pages

- 推送 commit 至 `main` 分支後，由 `.github/workflows/pages.yml` 自動執行 `npm ci` → `npm run build` → 上傳 `dist/` → 部署至 GitHub Pages。
- `main` 受分支保護，禁止 force-push 或將 `dist/` 手動 commit 至根目錄。

---

## 2. 目錄結構與核心檔案職責

```text
boshiamy-practice/
├── index.html                  # 進入點，含嚴格 meta CSP 與 PWA meta tags
├── vite.config.ts              # Vite + VitePWA（Workbox 預快取）設定
├── package.json                # 依賴與腳本定義
├── AGENTS.md                   # 代理協作、隱私紅線、測試與交接規則
├── ARCHITECTURE.md             # 本文件（專案架構與資料結構總覽）
├── .github/workflows/pages.yml # main 分支推送自動建置與部署 Pages
├── scripts/
│   ├── build-opencc.mjs        # 將 OpenCC 原始表編譯為 public/opencc-chars.json
│   └── sync-context.sh         # 透過 repomix 產出程式碼 Markdown 快照
├── data-src/                   # OpenCC 繁簡原始字表與 Apache-2.0 授權（打包快照排除）
├── public/
│   ├── liu-table.json          # 完整嘸蝦米字碼表（18,435 字，執行期 lazy fetch，快照排除）
│   ├── opencc-chars.json       # 繁簡字元對照表（t2s 4,148 / s2t 4,012，快照排除）
│   ├── opencc-LICENSE.txt      # OpenCC Apache-2.0 授權聲明（不可刪除）
│   ├── manifest.webmanifest    # PWA Manifest
│   └── icon-*.png / apple-touch-icon.png
├── src/
│   ├── main.tsx                # 應用程式掛載、主題初始化與 SW 註冊
│   ├── App.tsx                 # 主殼層與核心練習模式（字根／常用字／簡碼／限時）、內建前 1000 常用字與字根資料
│   ├── index.css               # 全域樣式、四套主題 CSS 變數與 RWD 佈局
│   ├── tableLoader.ts          # liu-table.json 與 opencc-chars.json 的單例快取載入器
│   ├── drawLogic.ts            # 洗牌袋（shuffle-bag）加權抽題與跨輪冷卻演算法
│   ├── shortLogic.ts           # 簡碼練習分級、計分與不劇透提示（純函式）
│   ├── simplifiedData.ts       # 常用千字精選簡體拆碼對照表
│   ├── simplifiedLogic.ts      # 簡體取碼提示查詢與字根拆解格式化（純函式）
│   ├── wordbookLogic.ts        # 生字本（上限 500 字）驗證、增刪與合併（純函式）
│   ├── weaknessLogic.ts        # 弱點消退（decayMissMap）與 26 鍵弱點熱區圖計算（純函式）
│   ├── phraseLogic.ts          # 詞彙連打題庫（日常詞／成語／科技職場）與對表解析（純函式）
│   ├── articleText.ts          # 維基百科文章擷取 URL、純文本清理與分字切段（純函式）
│   ├── lookupLogic.ts          # 正查／反查、繁簡異體查詢與注音式 Ruby 標註（純函式）
│   ├── historyLogic.ts         # 每日紀錄、連勝天數、熱圖、個人最佳與 JSON 備份驗證（純函式）
│   ├── theme.ts                # 四套主題（ink/studio/playful/minimal）與明暗模式 Context
│   ├── sound.ts                # Web Audio API 合成按鍵與回饋音效（零外部音檔）
│   ├── useIsMobile.ts          # 行動裝置／觸控指標 media query hook
│   ├── ArticleMode.tsx         # 文章練習介面（lazy chunk）
│   ├── PhraseMode.tsx          # 詞彙連打介面（lazy chunk）
│   ├── LookupMode.tsx          # 查碼與生字本入口介面（lazy chunk）
│   ├── WordbookPractice.tsx    # 生字本專屬練習元件
│   ├── HistoryMode.tsx         # 歷程圖表、12 週熱圖、弱項排行與備份匯出入（lazy chunk）
│   ├── MobileChrome.tsx        # 手機端殼層、底部導覽與 BottomSheet 設定抽屜
│   ├── OnScreenKeyboard.tsx    # 觸控螢幕虛擬英文鍵盤（含按壓回饋）
│   ├── KeycapBreakdown.tsx     # 逐鍵拆碼與錯鍵比對鍵帽元件
│   ├── SimpHintBar.tsx         # 簡體輔助拆碼提示列
│   └── ThemePicker.tsx         # 桌機／手機主題切換器與品牌 SVG 圖示
└── test-*.mjs                  # 邏輯單元測試與 Playwright UI／CSP／RWD 測試腳本
```

---

## 3. 核心資料結構

### 3.1 字碼表與對照表格式

1. **完整字碼表 `public/liu-table.json`**（18,435 字，約 284 KB；僅在開啟文章／詞彙／查碼模式時透過 `tableLoader.ts` 延遲載入並快取）
   - 型別：`Record<string, string>`（key 為單一中文字）
   - Value 格式：`"直接出字碼1 直接出字碼2|需選字碼1 需選字碼2"`
     - `|` 左側（以空白分隔）：空白鍵直接出字碼（`k`）。
     - `|` 右側（可省略，以空白分隔）：同碼須選字之候選碼（`a`）。
   - 範例：`"中": "ci|cj"`、`"一": "e"`、`"世": "sl jre"`。

2. **繁簡字元表 `public/opencc-chars.json`**（約 116 KB，來源為 OpenCC）
   - 型別：`{ t2s: Record<string, string[]>; s2t: Record<string, string[]> }`
   - 用於查碼模式呈現繁簡異體字與對應字碼，以及簡體取碼輔助提示。

3. **內建常用字與字根資料（`src/App.tsx`）**
   - `CHARS: CharItem[]`：教育部字頻總表前 1,000 常用字，含 `{ c, r, f, k, a? }`（字、字頻排名、出現頻次、直出碼陣列、選字碼陣列）。
   - `ROOTS: RootItem[]`：基本字根清單 `{ key, glyph, cat, memo }` 與 `KEY_REPS`（26 鍵代表字根）。
   - `SIMPLIFIED_CODE_MAP`（`src/simplifiedData.ts`）：針對前 1,000 常用字整理的精選簡體拆碼對照，未命中時可退回查詢 `liu-table.json` + `opencc-chars.json`。

### 3.2 `localStorage` 儲存結構

所有本機資料皆以版本化鍵名存於瀏覽器 `localStorage`，並透過 `historyLogic.ts` 進行備份匯出入（支援 `merge` / `replace`）：

| Key | 型別／格式 | 說明 |
| :--- | :--- | :--- |
| `boshiamy-practice-stats-v1` | `SavedStats`（`{ ok, tried, streak, missChars, missRoots }`） | 累計答對／作答數、目前連對、錯字與錯字根計數 |
| `boshiamy-practice-history-v1` | `HistoryStore`（`{ days: Record<"YYYY-MM-DD", DayRecord> }`） | 每日各模式（`roots`/`chars`/`short`/`phrases`/`timed`/`article`）的 `tried`/`ok`/`ms`，最多保留 400 天 |
| `boshiamy-bests-v1` | `PersonalBests`（`{ timedBestByDiff, timedRecent, articleBestCpm? }`） | 限時模式各難度最佳與近 5 次紀錄、文章模式最高 CPM |
| `boshiamy-wordbook-v1` | `string[]` | 自訂生字本字元清單（去重、上限 500 字，最新置前） |
| `boshiamy-auto-next-v2` | `"1"` \| `"0"` | 答對自動換題開關 |
| `boshiamy-daily-goal-v1` | 數字字串（預設 `"50"`，範圍 10–1000） | 每日目標題數（快捷選項 30／50／100／200） |
| `boshiamy-sound-v1` | `"1"` \| `"0"` | Web Audio 音效開關 |
| `boshiamy-theme-v1` | `"ink"` \| `"studio"` \| `"playful"` \| `"minimal"` | 外觀主題 ID |
| `boshiamy-color-mode-v1` | `"system"` \| `"light"` \| `"dark"` | 淺色／深色／跟隨系統模式 |

- **備份檔格式（`BackupFile`）**：`{ version: 1, exportedAt, stats, history, settings, bests?, wordbook? }`。
- **匯入資安防護**：檔案大小上限 2 MB、單一計數表上限 5,000 鍵、鍵長上限 16 字元、排除 `__proto__` / `constructor` / `prototype` 防原型污染。

### 3.3 PWA Manifest 與 Service Worker 機制

- **Manifest**：靜態維護於 `public/manifest.webmanifest`（`vite.config.ts` 設 `manifest: false` 避免覆寫），`start_url` 與 `scope` 均為 `./`，`display: "standalone"`，支援 Mac / iOS 加入主畫面。
- **Service Worker**：由 `vite-plugin-pwa` 自動生成 `sw.js`，於 `src/main.tsx` 執行 `registerSW({ immediate: true })`，採 `registerType: "autoUpdate"`。
- **Workbox 預快取**：`globPatterns` 涵蓋 `**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2,json}`，將程式碼、圖示、`liu-table.json` 與 `opencc-chars.json` 全數預快取以支援完全離線使用；`navigateFallback: "index.html"`。
- **CSP 策略**：`index.html` 透過 `<meta http-equiv="Content-Security-Policy">` 嚴格限制資源來源（`script-src 'self'`、`connect-src 'self' https://zh.wikipedia.org`、`object-src 'none'`），且由 `test-csp.mjs` 驗證零違規。

---

## 4. 已實作功能清單與已知限制

### 已實作功能

1. **六大練習模式**：
   - **字根練習（`roots`）**：正反雙向字根測驗、分類篩選與錯題加權復習。
   - **常用字練習（`chars`）**：前 100／300／600／1000 常用字分級、洗牌袋加權抽題（避免短時間重複）、錯字複習、逐鍵鍵帽拆解與簡體拆碼提示。
   - **簡碼練習（`short`）**：一碼／二碼前 100／二碼前 300／全部簡碼分級，嚴格判定簡碼並對誤打全碼或選字碼給予教練回饋。
   - **詞彙連打（`phrases`）**：內建日常雙字詞、四字成語、科技與職場詞庫（lazy chunk）。
   - **限時挑戰（`timed`）**：限時記分、難度分級與個人最佳／近期紀錄。
   - **文章練習（`article`）**：擷取繁體維基百科隨機條目引言，自動清理雜訊並逐字跟打計算 CPM 與正確率（lazy chunk）。
2. **查碼與生字本（`lookup`）**：
   - 自動辨識正查（輸入中文字，上限 400 字）與反查（輸入英文字碼，上限 12 組），支援注音式 Ruby 排版檢視與繁簡異體字一併查碼。
   - 可將字詞一鍵加入／移除**生字本**，並直接進入 `WordbookPractice` 針對個人生字進行專項練習。
   - **全站打通**：於常用字／簡碼／詞彙／文章答題回饋、文章結算錯字、紀錄頁弱點排行與熱區圖、桌機側邊欄常錯清單皆可直接收藏至生字本或一鍵跳轉查碼。
3. **學習紀錄、弱點閉環與備份（`history`）**：
   - 今日進度條、連續練習天數（streak）、近 7／30 天趨勢圖表、12 週練習熱圖、個人最佳成績與常錯字／字根弱項排行。
   - **弱點消退機制**：全練習模式（含限時挑戰與生字本複習）答對既有弱點字／字根時自動消退錯誤次數，歸零即移出弱點並顯示畢業回饋；複習錯字清空後顯示溫和完成提示。
   - **26 鍵鍵盤弱點熱區圖**：以 QWERTY 三排鍵帽視覺化呈現 26 鍵失誤分布（支援綜合／字根／拆字切換），點選鍵帽可展開該鍵弱點字根與錯字並串接查碼與生字本。
   - JSON 備份匯出（支援瀏覽器下載與 Web Share API）與合併／覆蓋匯入。
4. **外觀、音效與行動端體驗**：
   - 四套主題（文房墨綠、鍵盤工作室、晴朗練功、極簡）× 明暗模式切換。
   - Web Audio API 輕量按鍵／答對／答錯／連擊里程碑音效。
   - 完整手機 RWD 佈局（`MobileChrome` 底部導覽＋設定抽屜＋`OnScreenKeyboard` 虛擬英文鍵盤）。

### 已知限制

- **無雲端同步**：所有進度僅存於單一裝置瀏覽器的 `localStorage`，跨裝置需透過「紀錄 → 匯出／匯入 JSON」手動轉移。
- **文章練習需網路連線**：隨機維基文章仰賴 `https://zh.wikipedia.org` API，離線環境下無法載入新文章（其餘所有練習與查碼模式皆可完全離線使用）。
- **單檔結構偏大**：`src/App.tsx` 目前同時承載內建千字資料與多個核心練習模式（約 177 KB），重構拆分時須留意相依測試腳本（如 `test-short.mjs`、`test-draw.mjs`、`test-simplified.mjs` 會直接讀取 `src/App.tsx` 中的 `CHARS`）。
- **CSP 限制內聯腳本與外部連線**：`index.html` 採嚴格 meta CSP，不可引入外部字型／CDN／第三方腳本，新增任何外部 API 連線前必先評估並更新 CSP 與 `test-csp.mjs`。
