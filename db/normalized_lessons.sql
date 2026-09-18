-- ============================================================
-- WebCraft 課程教材正規化資料表架構 (Normalized Tables)
-- 將教材個別元素與值拆分為 course_stages 與 course_lessons
-- ============================================================

-- 1. 建立學習階段資料表 (course_stages)
CREATE TABLE IF NOT EXISTS course_stages (
  id INT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE course_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read course stages" ON course_stages;
CREATE POLICY "Anyone can read course stages"
  ON course_stages FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update course stages" ON course_stages;
CREATE POLICY "Anyone can insert or update course stages"
  ON course_stages FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 2. 建立課程單元資料表 (course_lessons)
-- 將單元的所有元素拆分入獨立欄位
CREATE TABLE IF NOT EXISTS course_lessons (
  id VARCHAR(40) PRIMARY KEY,
  lesson_number INT NOT NULL,
  stage_id INT NOT NULL REFERENCES course_stages(id) ON DELETE CASCADE,
  lesson_type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  objective TEXT NOT NULL,
  introduction TEXT NOT NULL,
  concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_title VARCHAR(200) NOT NULL,
  example_description TEXT NOT NULL,
  example_code TEXT NOT NULL,
  example_preview TEXT NOT NULL,
  practice_instructions TEXT NOT NULL,
  practice_starter_html TEXT NOT NULL DEFAULT '',
  practice_starter_css TEXT NOT NULL DEFAULT '',
  practice_starter_js TEXT NOT NULL DEFAULT '',
  practice_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  practice_answer_html TEXT NOT NULL DEFAULT '',
  practice_answer_css TEXT NOT NULL DEFAULT '',
  practice_answer_js TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_lessons_stage_idx ON course_lessons (stage_id, lesson_number);

ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read course lessons" ON course_lessons;
CREATE POLICY "Anyone can read course lessons"
  ON course_lessons FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update course lessons" ON course_lessons;
CREATE POLICY "Anyone can insert or update course lessons"
  ON course_lessons FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete course lessons" ON course_lessons;
CREATE POLICY "Anyone can delete course lessons"
  ON course_lessons FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- 3. 匯入 5 大階段資料 (course_stages)
-- ============================================================
INSERT INTO course_stages (id, title, updated_at)
VALUES
  (1, '階段一 · HTML 基礎', now()),
  (2, '階段二 · CSS 基礎', now()),
  (3, '階段三 · CSS 視覺效果', now()),
  (4, '階段四 · 排版與動態', now()),
  (5, '階段五 · JavaScript', now())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  updated_at = now();

-- ============================================================
-- 4. 匯入 17 個單元詳細元素資料 (course_lessons)
-- ============================================================
INSERT INTO course_lessons (
  id,
  lesson_number,
  stage_id,
  lesson_type,
  title,
  objective,
  introduction,
  concepts,
  example_title,
  example_description,
  example_code,
  example_preview,
  practice_instructions,
  practice_starter_html,
  practice_starter_css,
  practice_starter_js,
  practice_checklist,
  practice_answer_html,
  practice_answer_css,
  practice_answer_js,
  updated_at
)
VALUES
  (
    '1-1',
    1,
    1,
    'HTML',
    '語意化標籤與文件結構',
    '用正確的 HTML 標籤搭出清楚的頁面骨架。',
    'HTML 語意化標籤像是文章的骨架，讓瀏覽器、搜尋引擎和使用者都更容易理解頁面結構。',
    '[{"name":"<header>","description":"頁面或區塊的標題區域。"},{"name":"<nav>","description":"放置主要導覽連結。"},{"name":"<main>","description":"頁面最主要、獨特的內容。"},{"name":"<article>","description":"可以獨立閱讀的文章內容。"},{"name":"<footer>","description":"頁尾或區塊的補充資訊。"}]'::jsonb,
    'HTML 骨架範例',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<header>
  <h1>我的學習筆記</h1>
</header>
<nav>首頁　課程　關於我</nav>
<main>
  <article>
    <h2>今天學了語意化標籤</h2>
    <p>讓內容更容易理解。</p>
  </article>
</main>
<footer>© 2026 WebCraft</footer>',
    '<header>
  <h1>我的學習筆記</h1>
</header>
<nav>首頁　課程　關於我</nav>
<main>
  <article>
    <h2>今天學了語意化標籤</h2>
    <p>讓內容更容易理解。</p>
  </article>
</main>
<footer>© 2026 WebCraft</footer>',
    '把一份全部使用 div 的部落格頁面，改寫成 header、nav、main、section、article、footer 的語意化結構。',
    '<div class="blog">
  <div class="top">我的部落格</div>
  <div class="post">
    <h2>學習筆記</h2>
    <p>今天認識了 HTML 結構。</p>
  </div>
  <div class="bottom">作者：小明</div>
</div>',
    '',
    '',
    '["我使用了 header、nav、main、article、footer","內容層級使用正確的標題"]'::jsonb,
    '<header>
  <h1>我的部落格</h1>
</header>
<nav>首頁　文章　關於我</nav>
<main>
  <section>
    <article>
      <h2>學習筆記</h2>
      <p>今天認識了 HTML 結構。</p>
    </article>
  </section>
</main>
<footer>作者：小明</footer>',
    '',
    '',
    now()
  ),
  (
    '1-2',
    2,
    1,
    'HTML',
    '清單與表格',
    '理解清單與表格的資料結構及適用時機。',
    '清單適合整理項目，表格適合呈現有欄列關係的資料。先判斷資料的關係，再選擇合適的標籤。',
    '[{"name":"<ul>","description":"無順序清單，項目通常以圓點呈現。"},{"name":"<ol>","description":"有順序清單，項目會以編號呈現。"},{"name":"<li>","description":"清單中的單一項目。"},{"name":"<table>","description":"用來呈現列與欄的資料。"},{"name":"<th> / <td>","description":"欄位標題與一般資料儲存格。"}]'::jsonb,
    '課表與待辦清單',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<h2>本週課表</h2>
<table>
  <tr>
    <th>星期</th>
    <th>課程</th>
  </tr>
  <tr>
    <td>一</td>
    <td>軟體工程</td>
  </tr>
</table>
<h2>待辦事項</h2>
<ol>
  <li>預習 HTML</li>
  <li>完成練習</li>
</ol>',
    '<h2>本週課表</h2>
<table>
  <tr>
    <th>星期</th>
    <th>課程</th>
  </tr>
  <tr>
    <td>一</td>
    <td>軟體工程</td>
  </tr>
</table>
<h2>待辦事項</h2>
<ol>
  <li>預習 HTML</li>
  <li>完成練習</li>
</ol>',
    '把一份 Excel 截圖的課程資料轉成正確的 HTML table，並補上表格標題與欄位標題。',
    '<h2>資管系課程</h2>
<!-- 請將以下資料整理成 table -->
<p>星期一｜軟體工程｜教室 A101</p>
<p>星期三｜資料庫｜教室 B202</p>',
    '',
    '',
    '["表格有使用 th 表示標題","清單項目都放在 li 裡"]'::jsonb,
    '<h2>資管系課程</h2>
<table>
  <caption>本週課程表</caption>
  <tr>
    <th>星期</th>
    <th>課程</th>
    <th>教室</th>
  </tr>
  <tr>
    <td>星期一</td>
    <td>軟體工程</td>
    <td>A101</td>
  </tr>
  <tr>
    <td>星期三</td>
    <td>資料庫</td>
    <td>B202</td>
  </tr>
</table>',
    '',
    '',
    now()
  ),
  (
    '1-3',
    3,
    1,
    'HTML',
    '表單與輸入元素',
    '使用 label、input 與驗證屬性建立友善表單。',
    '表單是網頁收集使用者資料的方式。每個輸入欄位都應該有清楚的標籤與合適的輸入類型。',
    '[{"name":"<form>","description":"包住整組表單控制項。"},{"name":"<label>","description":"說明輸入欄位的用途。"},{"name":"for / id","description":"把標籤和對應欄位連結起來。"},{"name":"type","description":"指定文字、Email、密碼等輸入類型。"},{"name":"required","description":"要求欄位不可留白。"}]'::jsonb,
    '報名表單',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<form>
  <label for="name">姓名</label>
  <input id="name" required placeholder="請輸入姓名">
  <label for="email">Email</label>
  <input id="email" type="email" required>
  <button>送出報名</button>
</form>',
    '<form>
  <label for="name">姓名</label>
  <input id="name" required placeholder="請輸入姓名">
  <label for="email">Email</label>
  <input id="email" type="email" required>
  <button>送出報名</button>
</form>',
    '在報名表單的基礎上，做出登入表單與意見回饋表單，練習不同 input type。',
    '<form>
  <label for="account">帳號</label>
  <input id="account">
  <label for="password">密碼</label>
  <input id="password">
  <button>登入</button>
</form>',
    '',
    '',
    '["每個 input 都有對應的 label","必填欄位有 required"]'::jsonb,
    '<form>
  <label for="account">帳號</label>
  <input id="account" required>
  <label for="password">密碼</label>
  <input id="password" type="password" required>
  <label for="message">意見</label>
  <textarea id="message">
  </textarea>
  <button>送出</button>
</form>',
    '',
    '',
    now()
  ),
  (
    '2-4',
    4,
    2,
    'CSS',
    '選擇器與特異度',
    '掌握元素、class、id 與後代選擇器的優先順序。',
    'CSS 選擇器決定「要套用誰」，特異度則決定「衝突時誰優先」。理解這個規則，就能更有系統地除錯樣式。',
    '[{"name":"element","description":"直接選取 HTML 元素，例如 p。"},{"name":".class","description":"選取一群具有相同分類的元素。"},{"name":"#id","description":"選取具有特定唯一 id 的元素。"},{"name":"後代選擇器","description":"選取某個元素裡面的後代元素。"}]'::jsonb,
    '誰的顏色會生效？',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<button id="special" class="button">看看我的顏色</button>',
    '<button id="special" class="button">看看我的顏色</button>',
    '找出顏色套用錯誤的規則，利用 class、id 與後代選擇器修正按鈕樣式。',
    '<div class="panel">
  <button class="primary" id="save">儲存設定</button>
</div>',
    '.panel button  {
   background: #f3b45d;
   padding: 10px;
   border: 0;
}
.primary  {
   background: #5b8def;
}
#save  {
   color: white;
}',
    '',
    '["我能分辨元素、class、id 選擇器","我理解 id 通常比 class 具特異度"]'::jsonb,
    '<div class="panel">
  <button class="primary" id="save">儲存設定</button>
</div>',
    '.panel button  {
   background: #f3b45d;
}
.panel .primary  {
   background: #5b8def;
}
#save  {
   background: #e76f8f;
   color: white;
}',
    '',
    now()
  ),
  (
    '2-5',
    5,
    2,
    'CSS',
    '偽類與偽元素',
    '用狀態選擇器與生成內容打造細緻互動。',
    '偽類描述元素的狀態或位置；偽元素則能在元素前後產生裝飾內容。',
    '[{"name":":hover","description":"滑鼠移入元素時的狀態。"},{"name":":focus","description":"輸入欄位取得焦點時的狀態。"},{"name":":nth-child()","description":"依照元素在父層中的順序選取。"},{"name":"::before / ::after","description":"在內容前後生成裝飾內容。"}]'::jsonb,
    '狀態與裝飾',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<h2 class="title">互動按鈕</h2>
<button>移入我</button>',
    '<h2 class="title">互動按鈕</h2>
<button>移入我</button>',
    '用 :nth-child() 做出表格隔行變色，再用 ::after 為必填欄位加上紅色星號。',
    '<table>
  <tr>
    <td>HTML</td>
  </tr>
  <tr>
    <td>CSS</td>
  </tr>
  <tr>
    <td>JavaScript</td>
  </tr>
</table>
<label class="required">Email</label>',
    '',
    '',
    '["我使用了 :hover","我能說明 :before 與 :hover 的差異"]'::jsonb,
    '<table>
  <tr>
    <td>HTML</td>
  </tr>
  <tr>
    <td>CSS</td>
  </tr>
  <tr>
    <td>JavaScript</td>
  </tr>
</table>
<label class="required">Email</label>',
    'tr:nth-child(even)  {
   background: #eef0ff;
}
.required::after  {
   content: " *";
   color: #e76f8f;
}',
    '',
    now()
  ),
  (
    '2-6',
    6,
    2,
    'CSS',
    '盒模型與 box-sizing',
    '理解 margin、border、padding 如何影響元素尺寸。',
    '每個元素都可以想成一個盒子。內容、內距、邊框和外距共同決定它在頁面上佔用的空間。',
    '[{"name":"content","description":"元素真正放置文字或子元素的區域。"},{"name":"padding","description":"內容與邊框之間的內側空間。"},{"name":"border","description":"包住元素的邊線。"},{"name":"margin","description":"元素與其他元素之間的外側空間。"},{"name":"box-sizing","description":"控制 width 是否包含 padding 與 border。"}]'::jsonb,
    '卡片尺寸',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<div class="card">盒模型卡片</div>',
    '<div class="card">盒模型卡片</div>',
    '修正一個因為 padding 與 border 導致跑版的卡片，讓它回到原本設計尺寸。',
    '<div class="card">
  <h2>課程卡片</h2>
  <p>這張卡片目前尺寸跑掉了。</p>
  <button>開始學習</button>
</div>',
    '.card  {
   width: 280px;
   padding: 24px;
   border: 8px solid #5268e6;
}
button  {
   padding: 8px 14px;
}',
    '',
    '["我有設定 box-sizing","卡片沒有超出指定尺寸"]'::jsonb,
    '<div class="card">
  <h2>課程卡片</h2>
  <p>這張卡片尺寸固定且不會跑版。</p>
  <button>開始學習</button>
</div>',
    '.card  {
   box-sizing: border-box;
   width: 280px;
   padding: 24px;
   border: 8px solid #5268e6;
}',
    '',
    now()
  ),
  (
    '2-7',
    7,
    2,
    'CSS',
    '文字排版',
    '用字級、行高與字距改善內容的閱讀體驗。',
    '文字排版不只是調整大小，也包含行距、字距和粗細。好的排版能讓讀者更輕鬆閱讀內容。',
    '[{"name":"font-size","description":"設定文字大小。"},{"name":"line-height","description":"設定每一行文字的高度。"},{"name":"letter-spacing","description":"調整字元之間的距離。"},{"name":"font-weight","description":"設定文字粗細。"}]'::jsonb,
    '舒適的文章',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<article>
  <h2>一段好讀的文字</h2>
  <p>適當的行高與字距，可以讓讀者更容易閱讀長篇內容。</p>
</article>',
    '<article>
  <h2>一段好讀的文字</h2>
  <p>適當的行高與字距，可以讓讀者更容易閱讀長篇內容。</p>
</article>',
    '調整一篇文章的 font-size、line-height、letter-spacing 與 font-weight，達到指定的可讀性效果。',
    '<article>
  <h1>如何開始學習程式設計</h1>
  <p>學習程式設計需要練習，也需要閱讀與整理筆記。請調整這篇文章的排版，讓內容更容易閱讀。</p>
</article>',
    'article  {
   max-width: 420px;
}
h1  {
   font-weight: 400;
}
p  {
   font-size: 14px;
}',
    '',
    '["段落有適當的 line-height","標題與內文有清楚層次"]'::jsonb,
    '<article>
  <h1>如何開始學習程式設計</h1>
  <p>學習程式設計需要練習，也需要閱讀與整理筆記。舒適的排版能讓內容更容易閱讀。</p>
</article>',
    'article  {
   max-width: 420px;
}
h1  {
   font-size: 28px;
   font-weight: 700;
}
p  {
   font-size: 16px;
   line-height: 1.9;
   letter-spacing: .5px;
}',
    '',
    now()
  ),
  (
    '2-8',
    8,
    2,
    'CSS',
    '色彩與背景',
    '使用純色、漸層與背景圖片建立視覺氛圍。',
    '背景可以使用單色、圖片或漸層。漸層是從一種顏色平滑變化到另一種顏色的背景效果。',
    '[{"name":"color","description":"設定文字顏色。"},{"name":"background-color","description":"設定元素的背景色。"},{"name":"background-image","description":"設定背景圖片或漸層。"},{"name":"linear-gradient()","description":"建立線性漸層。"}]'::jsonb,
    '天空漸層',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<section class="sky">
  <h2>美好的一天</h2>
</section>',
    '<section class="sky">
  <h2>美好的一天</h2>
</section>',
    '使用 linear-gradient 做出天空到日落的背景效果，並讓文字在背景上清楚可讀。',
    '<section class="sunset">
  <h2>今日風景</h2>
  <p>把背景做成天空與夕陽的漸層。</p>
</section>',
    '.sunset  {
   height: 180px;
   padding: 24px;
   color: white;
}',
    '',
    '["我有使用 background 或 background-color","漸層至少有兩種顏色"]'::jsonb,
    '<section class="sunset">
  <h2>今日風景</h2>
  <p>天空與夕陽交會的時刻。</p>
</section>',
    '.sunset  {
   height: 180px;
   padding: 24px;
   color: white;
   background: linear-gradient(#5b8def, #f19b9b);
}',
    '',
    now()
  ),
  (
    '3-9',
    9,
    3,
    'CSS',
    '圓角 border-radius',
    '用圓角創造卡片、圓形與膠囊按鈕。',
    'border-radius 可以讓方形元素變得柔和，也能做出圓形、膠囊和不對稱的視覺造型。',
    '[{"name":"border-radius","description":"設定元素四個角的圓角程度。"},{"name":"50%","description":"在正方形上可做出正圓形。"},{"name":"999px","description":"常用來製作膠囊形按鈕。"}]'::jsonb,
    '圓角造型',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<div class="shapes">
  <span>卡片</span>
  <span>圓形</span>
  <span>膠囊</span>
</div>',
    '<div class="shapes">
  <span>卡片</span>
  <span>圓形</span>
  <span>膠囊</span>
</div>',
    '從圓角矩形延伸做出正圓形、膠囊按鈕與不對稱造型。',
    '<div class="gallery">
  <div>作品一</div>
  <div>作品二</div>
  <button>查看作品</button>
</div>',
    '.gallery  {
   display: flex;
   gap: 10px;
}
.gallery div, .gallery button  {
   padding: 20px;
   background: #dfe4ff;
}',
    '',
    '["我能使用不同 border-radius 值","圓形的寬高相同"]'::jsonb,
    '<div class="gallery">
  <div>作品一</div>
  <div class="circle">作品二</div>
  <button>查看作品</button>
</div>',
    '.gallery  {
   display: flex;
   gap: 10px;
   align-items: center;
}
.gallery div, .gallery button  {
   padding: 20px;
   background: #dfe4ff;
   border-radius: 14px;
}
.circle  {
   border-radius: 50% !important;
}
.gallery button  {
   border-radius: 999px;
}',
    '',
    now()
  ),
  (
    '3-10',
    10,
    3,
    'CSS',
    '陰影 box-shadow / text-shadow',
    '使用陰影製造浮起、凹陷與立體層次。',
    '陰影能讓平面的介面產生深度。box-shadow 作用在盒子，text-shadow 則作用在文字。',
    '[{"name":"offset-x / y","description":"控制陰影向左右、上下偏移。"},{"name":"blur","description":"控制陰影邊緣的模糊程度。"},{"name":"spread","description":"控制陰影擴張或縮小。"},{"name":"inset","description":"將陰影放到元素內側。"}]'::jsonb,
    '浮起的卡片',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<div class="card">
  <strong>設計靈感</strong>
  <p>陰影讓元素有了空間感。</p>
</div>',
    '<div class="card">
  <strong>設計靈感</strong>
  <p>陰影讓元素有了空間感。</p>
</div>',
    '做出按下去的凹陷按鈕，並用多層 box-shadow 製作立體效果。',
    '<button class="press">按下看看</button>
<div class="stack">立體卡片</div>',
    '.press  {
   padding: 12px 20px;
   border: 0;
   border-radius: 8px;
}
.stack  {
   margin-top: 20px;
   padding: 25px;
   background: white;
}',
    '',
    '["我設定了 offset 與 blur","陰影顏色不會太濃"]'::jsonb,
    '<button class="press">按下看看</button>
<div class="stack">立體卡片</div>',
    '.press  {
   padding: 12px 20px;
   border: 0;
   border-radius: 8px;
   box-shadow: 0 5px 0 #394aa3;
}
.press:active  {
   transform: translateY(4px);
   box-shadow: 0 1px 0 #394aa3;
}
.stack  {
   margin-top: 20px;
   padding: 25px;
   background: white;
   box-shadow: 0 8px 0 #c5ccef, 0 15px 25px #23345c33;
}',
    '',
    now()
  ),
  (
    '3-11',
    11,
    3,
    'CSS',
    '毛玻璃特效 backdrop-filter',
    '理解半透明背景與 blur 如何產生毛玻璃效果。',
    '毛玻璃效果需要半透明背景和可被模糊的背景內容，兩者搭配才能看出玻璃質感。',
    '[{"name":"backdrop-filter","description":"對元素後方的內容套用濾鏡。"},{"name":"blur()","description":"將背景內容模糊。"},{"name":"rgba / #RRGGBBAA","description":"建立帶有透明度的背景色。"}]'::jsonb,
    '玻璃卡片',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<div class="scene">
  <div class="glass">
    <h2>Glassmorphism</h2>
    <p>透過背景模糊創造層次。</p>
  </div>
</div>',
    '<div class="scene">
  <div class="glass">
    <h2>Glassmorphism</h2>
    <p>透過背景模糊創造層次。</p>
  </div>
</div>',
    '在背景圖或漸層上疊出毛玻璃導覽列，調整 blur 與半透明色的質感。',
    '<div class="background">
  <nav class="nav">首頁　課程　作品　聯絡</nav>
  <div class="glass">探索我的作品集</div>
</div>',
    '.background  {
   min-height: 180px;
   padding: 25px;
   background: linear-gradient(135deg,#5268e6,#e47eaa);
}
.nav, .glass  {
   color: white;
   padding: 14px;
}',
    '',
    '["背景有半透明色","我有使用 backdrop-filter: blur"]'::jsonb,
    '<div class="background">
  <nav class="nav">首頁　課程　作品　聯絡</nav>
  <div class="glass">探索我的作品集</div>
</div>',
    '.background  {
   min-height: 180px;
   padding: 25px;
   background: linear-gradient(135deg,#5268e6,#e47eaa);
}
.nav, .glass  {
   color: white;
   padding: 14px;
   background: #ffffff33;
   backdrop-filter: blur(10px);
   border: 1px solid #ffffff66;
   border-radius: 12px;
}
.glass  {
   margin-top: 25px;
}',
    '',
    now()
  ),
  (
    '3-12',
    12,
    3,
    'CSS',
    'transform 變形',
    '用 translate、rotate、scale 與 origin 製造動態感。',
    'transform 可以在不影響其他元素排版的情況下移動、旋轉或縮放元素，是製作互動效果的重要工具。',
    '[{"name":"translate","description":"移動元素的位置。"},{"name":"rotate","description":"旋轉元素。"},{"name":"scale","description":"放大或縮小元素。"},{"name":"transform-origin","description":"設定變形發生的基準點。"}]'::jsonb,
    'Hover 變形卡片',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<div class="card">移入看看</div>',
    '<div class="card">移入看看</div>',
    '使用 transform 與 transform-origin 做出翻牌效果或傾斜的相片牆。',
    '<div class="scene">
  <div class="photo">前面</div>
  <div class="photo back">背面</div>
</div>',
    '.scene  {
   position: relative;
   width: 150px;
   height: 110px;
}
.photo  {
   position: absolute;
   padding: 40px 30px;
   background: #dfe4ff;
}',
    '',
    '["我有使用 transform","變化有 transition 過渡"]'::jsonb,
    '<div class="scene">
  <div class="photo">前面</div>
  <div class="photo back">背面</div>
</div>',
    '.scene  {
   position: relative;
   width: 150px;
   height: 110px;
   perspective: 600px;
}
.photo  {
   position: absolute;
   padding: 40px 30px;
   background: #dfe4ff;
   transition: transform .5s;
   backface-visibility: hidden;
}
.back  {
   transform: rotateY(180deg);
}
.scene:hover .photo  {
   transform: rotateY(180deg);
}
.scene:hover .back  {
   transform: rotateY(360deg);
}',
    '',
    now()
  ),
  (
    '4-13',
    13,
    4,
    'CSS',
    'Flexbox 排版',
    '使用一維排版對齊導覽列與卡片欄位。',
    'Flexbox 是一維排版工具，適合處理同一列或同一欄中的對齊、間距和換行。',
    '[{"name":"display: flex","description":"把元素容器變成 Flex 容器。"},{"name":"justify-content","description":"控制主軸方向的排列方式。"},{"name":"align-items","description":"控制交叉軸方向的對齊。"},{"name":"flex-wrap","description":"內容太窄時是否換行。"}]'::jsonb,
    '三欄卡片',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<div class="row">
  <div>HTML</div>
  <div>CSS</div>
  <div>JS</div>
</div>',
    '<div class="row">
  <div>HTML</div>
  <div>CSS</div>
  <div>JS</div>
</div>',
    '使用 Flexbox 做出置中卡片與等分三欄排版，並處理小螢幕換行。',
    '<nav class="nav">
  <strong>WebCraft</strong>
  <div>
    <a>課程</a>
    <a>練習</a>
    <a>關於</a>
  </div>
</nav>
<section class="cards">
  <div>HTML</div>
  <div>CSS</div>
  <div>JavaScript</div>
</section>',
    '.nav  {
   padding: 14px;
   background: #eef0ff;
}
.cards div  {
   padding: 25px;
   background: #dfe4ff;
}',
    '',
    '["容器有 display:flex","三個欄位寬度相等"]'::jsonb,
    '<nav class="nav">
  <strong>WebCraft</strong>
  <div>
    <a>課程</a>
    <a>練習</a>
    <a>關於</a>
  </div>
</nav>
<section class="cards">
  <div>HTML</div>
  <div>CSS</div>
  <div>JavaScript</div>
</section>',
    '.nav, .cards  {
   display: flex;
   gap: 16px;
}
.nav  {
   justify-content: space-between;
   align-items: center;
   padding: 14px;
   background: #eef0ff;
}
.cards  {
   flex-wrap: wrap;
}
.cards div  {
   flex: 1;
   min-width: 120px;
   padding: 25px;
   background: #dfe4ff;
}',
    '',
    now()
  ),
  (
    '4-14',
    14,
    4,
    'CSS',
    'transition 過渡動畫',
    '讓 hover 或 class 狀態的變化平滑呈現。',
    'transition 讓 CSS 屬性改變時有平滑的過程，常和 hover、focus 或 class 切換一起使用。',
    '[{"name":"transition-property","description":"指定哪些屬性要有過渡效果。"},{"name":"duration","description":"設定變化需要多久。"},{"name":"timing-function","description":"控制變化速度曲線。"}]'::jsonb,
    '平滑按鈕',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<button class="smooth">移入我</button>',
    '<button class="smooth">移入我</button>',
    '用 transition 做出手風琴展開與收合的平滑動畫。',
    '<div class="faq">
  <button>什麼是 HTML？</button>
  <p>HTML 是網頁的結構。</p>
  <button>什麼是 CSS？</button>
  <p>CSS 負責網頁外觀。</p>
</div>',
    '.faq p  {
   max-height: 0;
   overflow: hidden;
   margin: 0;
}
.faq button  {
   display: block;
   padding: 10px;
}',
    '',
    '["transition 寫在原始狀態","變化不會瞬間跳動"]'::jsonb,
    '<div class="faq">
  <button>什麼是 HTML？</button>
  <p>HTML 是網頁的結構。</p>
  <button>什麼是 CSS？</button>
  <p>CSS 負責網頁外觀。</p>
</div>',
    '.faq p  {
   max-height: 0;
   overflow: hidden;
   margin: 0;
   transition: max-height .3s, padding .3s;
}
.faq button  {
   display: block;
   padding: 10px;
}
.faq button:hover + p  {
   max-height: 50px;
   padding: 10px;
}',
    '',
    now()
  ),
  (
    '5-15',
    15,
    5,
    'JavaScript',
    'DOM 選取與內容操作',
    '選取元素並用 JavaScript 更新文字與樣式。',
    'DOM 是瀏覽器把 HTML 轉成的樹狀結構。JavaScript 可以選取其中的元素，並修改文字或內容。',
    '[{"name":"querySelector()","description":"用 CSS 選擇器找出第一個元素。"},{"name":"textContent","description":"讀取或修改純文字內容。"},{"name":"innerHTML","description":"讀取或修改 HTML 內容。"},{"name":"style","description":"直接修改元素的 inline style。"}]'::jsonb,
    '點擊改變文字',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<p id="message">還沒有按下按鈕</p>
<button id="change">點我</button>',
    '<p id="message">還沒有按下按鈕</p>
<button id="change">點我</button>',
    '使用 querySelector 與 textContent 做出簡易字數統計或即時預覽輸入內容。',
    '<label>留言內容</label>
<textarea id="comment">
</textarea>
<p>目前字數：<span id="count">0</span>
</p>',
    'textarea  {
   display: block;
   width: 260px;
   height: 80px;
}',
    'const input = document.querySelector(''#comment'')
const count = document.querySelector(''#count'')',
    '["我有使用 querySelector","點擊後 textContent 會更新"]'::jsonb,
    '<label>留言內容</label>
<textarea id="comment">
</textarea>
<p>目前字數：<span id="count">0</span>
</p>',
    'textarea  {
   display: block;
   width: 260px;
   height: 80px;
}',
    'const input = document.querySelector(''#comment'')
const count = document.querySelector(''#count'')
input.addEventListener(''input'', () =>  {
   count.textContent = input.value.length 
}
)',
    now()
  ),
  (
    '5-16',
    16,
    5,
    'JavaScript',
    '事件監聽 addEventListener',
    '掌握 click、input 等事件，讓頁面回應使用者。',
    '事件是使用者或瀏覽器發生的動作，例如點擊、輸入和滑鼠移入。事件監聽器可以讓頁面回應這些動作。',
    '[{"name":"click","description":"使用者點擊元素時觸發。"},{"name":"input","description":"輸入欄位內容改變時觸發。"},{"name":"mouseenter","description":"滑鼠移入元素時觸發。"},{"name":"event","description":"包含這次事件相關資訊的物件。"}]'::jsonb,
    '即時輸入預覽',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<input id="name" placeholder="輸入名字">
<p>你好，<span id="output">訪客</span>！</p>',
    '<input id="name" placeholder="輸入名字">
<p>你好，<span id="output">訪客</span>！</p>',
    '使用 click、mouseenter、mouseleave 或 input 事件，完成開關燈效果或表單即時驗證。',
    '<button id="light">開關燈</button>
<div id="room">房間</div>',
    '#room  {
   width: 180px;
   padding: 45px 20px;
   background: #273149;
   color: white;
}',
    'document.querySelector(''#light'').addEventListener(''click'', () =>  {

  document.querySelector(''#room'').classList.toggle(''on'')

}
)',
    '["我有監聽 input 事件","空值時仍有預設文字"]'::jsonb,
    '<button id="light">開關燈</button>
<div id="room">房間</div>',
    '#room  {
   width: 180px;
   padding: 45px 20px;
   background: #273149;
   color: white;
}
#room.on  {
   background: #ffe28a;
   color: #172033;
}',
    'document.querySelector(''#light'').addEventListener(''click'', () =>  {

  document.querySelector(''#room'').classList.toggle(''on'')

}
)',
    now()
  ),
  (
    '5-17',
    17,
    5,
    'JavaScript',
    '動態增刪元素與 classList',
    '建立元素、加入清單並切換深色模式。',
    '最後把前面學到的 DOM、事件與 CSS 狀態結合起來，動態建立元素、刪除項目並切換頁面模式。',
    '[{"name":"createElement()","description":"建立新的 HTML 元素。"},{"name":"appendChild()","description":"把元素加入另一個元素裡。"},{"name":"remove()","description":"從頁面移除元素。"},{"name":"classList.toggle()","description":"切換元素是否具有某個 class。"}]'::jsonb,
    '待辦清單',
    '先觀察完整範例的結構，再到下方編輯器動手修改。',
    '<input id="todo" placeholder="新增待辦">
<button id="add">新增</button>
<ul id="list">
</ul>',
    '<input id="todo" placeholder="新增待辦">
<button id="add">新增</button>
<ul id="list">
</ul>',
    '完成可新增、刪除待辦事項的清單，再加入 classList.toggle 實作深色模式。',
    '<input id="todo" placeholder="新增待辦">
<button id="add">新增</button>
<ul id="list">
  <li>完成 HTML 練習 <button>刪除</button>
</li>
</ul>',
    'body  {
   transition: .3s;
}
.dark  {
   background: #172033;
   color: white;
}',
    'const list = document.querySelector(''#list'')
const add = document.querySelector(''#add'')',
    '["我有使用 createElement 與 appendChild","新增後輸入框會清空"]'::jsonb,
    '<input id="todo" placeholder="新增待辦">
<button id="add">新增</button>
<button id="theme">深色模式</button>
<ul id="list">
  <li>完成 HTML 練習 <button class="remove">刪除</button>
</li>
</ul>',
    'body  {
   transition: .3s;
}
.dark  {
   background: #172033;
   color: white;
}',
    'const list = document.querySelector(''#list'')
const add = document.querySelector(''#add'')
const input = document.querySelector(''#todo'')
add.addEventListener(''click'', () =>  {

  if (!input.value) return
  const li = document.createElement(''li'')
  li.append(document.createTextNode(input.value + '' ''))
  const remove = document.createElement(''button'')
  remove.className = ''remove''
  remove.textContent = ''刪除''
  remove.addEventListener(''click'', () => li.remove())
  li.appendChild(remove)
  list.appendChild(li)
  input.value = ''''

}
)
document.querySelector(''#theme'').addEventListener(''click'', () => document.body.classList.toggle(''dark''))',
    now()
  )
ON CONFLICT (id) DO UPDATE SET
  lesson_number = EXCLUDED.lesson_number,
  stage_id = EXCLUDED.stage_id,
  lesson_type = EXCLUDED.lesson_type,
  title = EXCLUDED.title,
  objective = EXCLUDED.objective,
  introduction = EXCLUDED.introduction,
  concepts = EXCLUDED.concepts,
  example_title = EXCLUDED.example_title,
  example_description = EXCLUDED.example_description,
  example_code = EXCLUDED.example_code,
  example_preview = EXCLUDED.example_preview,
  practice_instructions = EXCLUDED.practice_instructions,
  practice_starter_html = EXCLUDED.practice_starter_html,
  practice_starter_css = EXCLUDED.practice_starter_css,
  practice_starter_js = EXCLUDED.practice_starter_js,
  practice_checklist = EXCLUDED.practice_checklist,
  practice_answer_html = EXCLUDED.practice_answer_html,
  practice_answer_css = EXCLUDED.practice_answer_css,
  practice_answer_js = EXCLUDED.practice_answer_js,
  updated_at = now();
