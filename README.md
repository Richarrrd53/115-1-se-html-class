# WebCraft

WebCraft 是一個以 **Vite + Vue 3 + TypeScript** 建立的前端互動學習專案，提供 HTML、CSS 與 JavaScript 的分階段課程、程式碼練習區、即時預覽和學習進度記錄。

專案使用 Vue 3 的 `<script setup>` 語法與單一檔案元件（SFC），適合用來練習前端基礎，也方便團隊分工維護課程內容與介面功能。

## 技術與功能概覽

- **Vue 3**：建立元件化的使用者介面與互動狀態。
- **TypeScript**：為課程資料與前端邏輯提供型別檢查。
- **Vite**：提供快速的開發伺服器與生產環境打包流程。
- **互動課程**：依 HTML、CSS、視覺效果、排版動態與 JavaScript 分階段學習。
- **即時預覽**：在練習區編輯 HTML、CSS、JavaScript 後，即時查看結果。
- **進度記錄**：使用瀏覽器 `localStorage` 保存個人狀態，並可透過 PostgreSQL API 記錄練習同學。

## 目錄結構與模組說明

```text
.
├── .vscode/                # VS Code 延伸模組與工作區設定
├── dist/                   # 生產環境打包輸出（由 npm run build 產生）
├── public/                 # 不需經過打包處理的靜態資源
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/             # 會由 Vite 處理的圖檔、字型或其他樣式資源
│   ├── components/
│   │   └── HelloWorld.vue  # 可重用的 Vue 元件範例
│   ├── App.vue             # 根元件與主要課程操作介面
│   ├── lessons.ts          # 課程資料、型別、範例、練習與參考答案
│   ├── main.ts             # 應用程式入口，建立 Vue app 並掛載至 #app
│   └── style.css           # 全域樣式
├── index.html              # Vite 的 HTML 模板入口
├── package.json            # 專案資訊、相依套件與 npm scripts
├── package-lock.json       # npm 相依套件版本鎖定檔
├── tsconfig.json           # TypeScript 專案共用設定
├── tsconfig.app.json       # 應用程式原始碼的 TypeScript 設定
├── tsconfig.node.json      # Vite 設定檔等 Node.js 程式的 TypeScript 設定
├── vite.config.ts          # Vite 建置與開發伺服器設定
└── README.md               # 專案說明文件
```

### `src/lessons.ts`

這是課程領域資料的集中管理模組，包含課程型別、階段資訊、課程介紹、關鍵概念、範例程式碼、練習題、檢查清單與參考答案。新增或修改課程時，優先在這個檔案更新資料，避免把課程內容直接寫在畫面模板中。

協作建議：

- 新增課程時維持既有的 `Lesson` 資料結構與課程編號規則。
- 調整課程內容時，同步檢查範例、練習起始碼、檢查清單與參考答案。
- 若要改變資料結構，請先確認 `App.vue` 的使用方式，再一起更新型別與畫面邏輯。

### `src/App.vue`

這是目前的根元件，負責課程地圖、單元切換、課程內容呈現、HTML/CSS/JavaScript 編輯器、`iframe` 即時預覽、完成狀態與參考答案顯示。完成狀態與目前單元會透過 `localStorage` 保存在使用者的瀏覽器中。

協作建議：

- 介面功能或互動狀態的修改集中在這裡，課程文字與資料則放在 `lessons.ts`。
- 當畫面持續變大時，可將課程側欄、程式碼編輯器或預覽區拆成 `components/` 下的獨立元件。
- 修改即時預覽時，請特別留意 `iframe` 的 `sandbox` 設定與使用者輸入程式碼的安全性。

### `src/components/`

這個資料夾用來放可重複使用、職責清楚的 Vue 元件。目前的 `HelloWorld.vue` 是初始模板留下的元件範例；若團隊將 `App.vue` 拆分成多個畫面區塊，建議依功能命名，例如 `CourseSidebar.vue`、`CodeEditor.vue` 或 `LessonPreview.vue`，讓元件更容易測試與協作。

## 開發環境與快速啟動

### 前置需求

- Node.js **20.19 以上**（或 Node.js 22.12 以上）
- npm（通常會隨 Node.js 一起安裝）
- 建議使用 VS Code，並安裝專案指定的 Vue 開發相關延伸模組

可先確認版本：

```bash
node --version
npm --version
```

### 安裝相依套件

在專案根目錄執行：

```bash
npm install
```

### 啟用 PostgreSQL 練習紀錄

先建立資料庫並執行 `db/schema.sql`，再設定連線字串：

```powershell
$env:DATABASE_URL = "postgres://使用者:密碼@localhost:5432/webcraft"
```

開啟兩個終端機，分別執行 `npm run server` 與 `npm run dev`。學生在首頁輸入姓名後，開啟單元或標記完成時會寫入 PostgreSQL；同一單元的練習名單會顯示在頁首。未啟動 API 時，原本的 `localStorage` 個人進度仍可使用，但不會同步到資料庫。

### 啟動本地開發伺服器

```bash
npm run dev
```

啟動後，依終端機顯示的網址開啟瀏覽器，通常是 `http://localhost:5173/`。修改 `src/` 內的檔案後，Vite 會透過熱更新反映變更。

### 生產環境打包

```bash
npm run build
```

此指令會先執行 TypeScript 型別檢查，再由 Vite 將專案輸出至 `dist/`。若要在本機預覽打包結果，可執行：

```bash
npm run preview
```

## Git 上傳前注意事項

1. 確認目前位於專案根目錄，並檢查 `.gitignore` 是否包含以下項目：

	```gitignore
	node_modules/
	dist/
	```

2. **不要提交 `node_modules/`**：這是可由 `npm install` 重新產生的本地相依套件，檔案數量多且不適合放入 Git。
3. **通常不要提交 `dist/`**：這是由 `npm run build` 產生的打包成果；除非部署流程明確要求，否則應由 CI/CD 或部署平台重新建置。
4. **請提交 `package-lock.json`**：它能讓團隊成員安裝到一致的相依套件版本。
5. 提交前可檢查未追蹤檔案與差異：

	```bash
	git status
	git diff
	```

6. 建議先完成一次本地建置，確認型別檢查與打包都成功，再建立 commit：

	```bash
	npm run build
	git add .
	git commit -m "docs: update project README"
	```

## 團隊協作建議

- 課程資料與課程介面分開修改，降低多人同時編輯同一段程式碼的衝突。
- 提交訊息清楚描述變更範圍，例如 `feat: add CSS lesson` 或 `fix: update preview behavior`。
- Pull Request 中說明修改內容、測試方式，以及是否需要同步調整課程資料或型別。
- 修改全域樣式前，先確認是否會影響課程預覽、編輯器與響應式版面。
