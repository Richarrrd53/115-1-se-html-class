-- ============================================================
-- 1. 建立 course_content 教材內容資料表與 RLS 權限政策
-- ============================================================
CREATE TABLE IF NOT EXISTS course_content (
  id VARCHAR(40) PRIMARY KEY,
  stages JSONB NOT NULL,
  lessons JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE course_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read course content" ON course_content;
CREATE POLICY "Anyone can read course content"
  ON course_content FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update course content" ON course_content;
CREATE POLICY "Anyone can insert or update course content"
  ON course_content FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 2. 匯入 lessons.ts 的完整教材內容（共 5 大階段，17 個單元）
-- ============================================================
INSERT INTO course_content (id, stages, lessons, updated_at)
VALUES (
  'current',
  '[
  {
    "id": 1,
    "title": "階段一 · HTML 基礎"
  },
  {
    "id": 2,
    "title": "階段二 · CSS 基礎"
  },
  {
    "id": 3,
    "title": "階段三 · CSS 視覺效果"
  },
  {
    "id": 4,
    "title": "階段四 · 排版與動態"
  },
  {
    "id": 5,
    "title": "階段五 · JavaScript"
  }
]'::jsonb,
  '[
  {
    "id": "1-1",
    "number": 1,
    "stage": 1,
    "type": "HTML",
    "title": "語意化標籤與文件結構",
    "objective": "用正確的 HTML 標籤搭出清楚的頁面骨架。",
    "introduction": "HTML 語意化標籤像是文章的骨架，讓瀏覽器、搜尋引擎和使用者都更容易理解頁面結構。",
    "concepts": [
      {
        "name": "<header>",
        "description": "頁面或區塊的標題區域。"
      },
      {
        "name": "<nav>",
        "description": "放置主要導覽連結。"
      },
      {
        "name": "<main>",
        "description": "頁面最主要、獨特的內容。"
      },
      {
        "name": "<article>",
        "description": "可以獨立閱讀的文章內容。"
      },
      {
        "name": "<footer>",
        "description": "頁尾或區塊的補充資訊。"
      }
    ],
    "example": {
      "title": "HTML 骨架範例",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<header>\n  <h1>我的學習筆記</h1>\n</header>\n<nav>首頁　課程　關於我</nav>\n<main>\n  <article>\n    <h2>今天學了語意化標籤</h2>\n    <p>讓內容更容易理解。</p>\n  </article>\n</main>\n<footer>© 2026 WebCraft</footer>",
      "preview": "<header>\n  <h1>我的學習筆記</h1>\n</header>\n<nav>首頁　課程　關於我</nav>\n<main>\n  <article>\n    <h2>今天學了語意化標籤</h2>\n    <p>讓內容更容易理解。</p>\n  </article>\n</main>\n<footer>© 2026 WebCraft</footer>"
    },
    "practice": {
      "instructions": "把一份全部使用 div 的部落格頁面，改寫成 header、nav、main、section、article、footer 的語意化結構。",
      "starterCode": {
        "html": "<div class=\"blog\">\n  <div class=\"top\">我的部落格</div>\n  <div class=\"post\">\n    <h2>學習筆記</h2>\n    <p>今天認識了 HTML 結構。</p>\n  </div>\n  <div class=\"bottom\">作者：小明</div>\n</div>",
        "css": "",
        "js": ""
      },
      "checklist": [
        "我使用了 header、nav、main、article、footer",
        "內容層級使用正確的標題"
      ],
      "answer": {
        "html": "<header>\n  <h1>我的部落格</h1>\n</header>\n<nav>首頁　文章　關於我</nav>\n<main>\n  <section>\n    <article>\n      <h2>學習筆記</h2>\n      <p>今天認識了 HTML 結構。</p>\n    </article>\n  </section>\n</main>\n<footer>作者：小明</footer>",
        "css": "",
        "js": ""
      }
    }
  },
  {
    "id": "1-2",
    "number": 2,
    "stage": 1,
    "type": "HTML",
    "title": "清單與表格",
    "objective": "理解清單與表格的資料結構及適用時機。",
    "introduction": "清單適合整理項目，表格適合呈現有欄列關係的資料。先判斷資料的關係，再選擇合適的標籤。",
    "concepts": [
      {
        "name": "<ul>",
        "description": "無順序清單，項目通常以圓點呈現。"
      },
      {
        "name": "<ol>",
        "description": "有順序清單，項目會以編號呈現。"
      },
      {
        "name": "<li>",
        "description": "清單中的單一項目。"
      },
      {
        "name": "<table>",
        "description": "用來呈現列與欄的資料。"
      },
      {
        "name": "<th> / <td>",
        "description": "欄位標題與一般資料儲存格。"
      }
    ],
    "example": {
      "title": "課表與待辦清單",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<h2>本週課表</h2>\n<table>\n  <tr>\n    <th>星期</th>\n    <th>課程</th>\n  </tr>\n  <tr>\n    <td>一</td>\n    <td>軟體工程</td>\n  </tr>\n</table>\n<h2>待辦事項</h2>\n<ol>\n  <li>預習 HTML</li>\n  <li>完成練習</li>\n</ol>",
      "preview": "<h2>本週課表</h2>\n<table>\n  <tr>\n    <th>星期</th>\n    <th>課程</th>\n  </tr>\n  <tr>\n    <td>一</td>\n    <td>軟體工程</td>\n  </tr>\n</table>\n<h2>待辦事項</h2>\n<ol>\n  <li>預習 HTML</li>\n  <li>完成練習</li>\n</ol>"
    },
    "practice": {
      "instructions": "把一份 Excel 截圖的課程資料轉成正確的 HTML table，並補上表格標題與欄位標題。",
      "starterCode": {
        "html": "<h2>資管系課程</h2>\n<!-- 請將以下資料整理成 table -->\n<p>星期一｜軟體工程｜教室 A101</p>\n<p>星期三｜資料庫｜教室 B202</p>",
        "css": "",
        "js": ""
      },
      "checklist": [
        "表格有使用 th 表示標題",
        "清單項目都放在 li 裡"
      ],
      "answer": {
        "html": "<h2>資管系課程</h2>\n<table>\n  <caption>本週課程表</caption>\n  <tr>\n    <th>星期</th>\n    <th>課程</th>\n    <th>教室</th>\n  </tr>\n  <tr>\n    <td>星期一</td>\n    <td>軟體工程</td>\n    <td>A101</td>\n  </tr>\n  <tr>\n    <td>星期三</td>\n    <td>資料庫</td>\n    <td>B202</td>\n  </tr>\n</table>",
        "css": "",
        "js": ""
      }
    }
  },
  {
    "id": "1-3",
    "number": 3,
    "stage": 1,
    "type": "HTML",
    "title": "表單與輸入元素",
    "objective": "使用 label、input 與驗證屬性建立友善表單。",
    "introduction": "表單是網頁收集使用者資料的方式。每個輸入欄位都應該有清楚的標籤與合適的輸入類型。",
    "concepts": [
      {
        "name": "<form>",
        "description": "包住整組表單控制項。"
      },
      {
        "name": "<label>",
        "description": "說明輸入欄位的用途。"
      },
      {
        "name": "for / id",
        "description": "把標籤和對應欄位連結起來。"
      },
      {
        "name": "type",
        "description": "指定文字、Email、密碼等輸入類型。"
      },
      {
        "name": "required",
        "description": "要求欄位不可留白。"
      }
    ],
    "example": {
      "title": "報名表單",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<form>\n  <label for=\"name\">姓名</label>\n  <input id=\"name\" required placeholder=\"請輸入姓名\">\n  <label for=\"email\">Email</label>\n  <input id=\"email\" type=\"email\" required>\n  <button>送出報名</button>\n</form>",
      "preview": "<form>\n  <label for=\"name\">姓名</label>\n  <input id=\"name\" required placeholder=\"請輸入姓名\">\n  <label for=\"email\">Email</label>\n  <input id=\"email\" type=\"email\" required>\n  <button>送出報名</button>\n</form>"
    },
    "practice": {
      "instructions": "在報名表單的基礎上，做出登入表單與意見回饋表單，練習不同 input type。",
      "starterCode": {
        "html": "<form>\n  <label for=\"account\">帳號</label>\n  <input id=\"account\">\n  <label for=\"password\">密碼</label>\n  <input id=\"password\">\n  <button>登入</button>\n</form>",
        "css": "",
        "js": ""
      },
      "checklist": [
        "每個 input 都有對應的 label",
        "必填欄位有 required"
      ],
      "answer": {
        "html": "<form>\n  <label for=\"account\">帳號</label>\n  <input id=\"account\" required>\n  <label for=\"password\">密碼</label>\n  <input id=\"password\" type=\"password\" required>\n  <label for=\"message\">意見</label>\n  <textarea id=\"message\">\n  </textarea>\n  <button>送出</button>\n</form>",
        "css": "",
        "js": ""
      }
    }
  },
  {
    "id": "2-4",
    "number": 4,
    "stage": 2,
    "type": "CSS",
    "title": "選擇器與特異度",
    "objective": "掌握元素、class、id 與後代選擇器的優先順序。",
    "introduction": "CSS 選擇器決定「要套用誰」，特異度則決定「衝突時誰優先」。理解這個規則，就能更有系統地除錯樣式。",
    "concepts": [
      {
        "name": "element",
        "description": "直接選取 HTML 元素，例如 p。"
      },
      {
        "name": ".class",
        "description": "選取一群具有相同分類的元素。"
      },
      {
        "name": "#id",
        "description": "選取具有特定唯一 id 的元素。"
      },
      {
        "name": "後代選擇器",
        "description": "選取某個元素裡面的後代元素。"
      }
    ],
    "example": {
      "title": "誰的顏色會生效？",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<button id=\"special\" class=\"button\">看看我的顏色</button>",
      "preview": "<button id=\"special\" class=\"button\">看看我的顏色</button>"
    },
    "practice": {
      "instructions": "找出顏色套用錯誤的規則，利用 class、id 與後代選擇器修正按鈕樣式。",
      "starterCode": {
        "html": "<div class=\"panel\">\n  <button class=\"primary\" id=\"save\">儲存設定</button>\n</div>",
        "css": ".panel button  {\n   background: #f3b45d;\n   padding: 10px;\n   border: 0;\n}\n.primary  {\n   background: #5b8def;\n}\n#save  {\n   color: white;\n}",
        "js": ""
      },
      "checklist": [
        "我能分辨元素、class、id 選擇器",
        "我理解 id 通常比 class 具特異度"
      ],
      "answer": {
        "html": "<div class=\"panel\">\n  <button class=\"primary\" id=\"save\">儲存設定</button>\n</div>",
        "css": ".panel button  {\n   background: #f3b45d;\n}\n.panel .primary  {\n   background: #5b8def;\n}\n#save  {\n   background: #e76f8f;\n   color: white;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "2-5",
    "number": 5,
    "stage": 2,
    "type": "CSS",
    "title": "偽類與偽元素",
    "objective": "用狀態選擇器與生成內容打造細緻互動。",
    "introduction": "偽類描述元素的狀態或位置；偽元素則能在元素前後產生裝飾內容。",
    "concepts": [
      {
        "name": ":hover",
        "description": "滑鼠移入元素時的狀態。"
      },
      {
        "name": ":focus",
        "description": "輸入欄位取得焦點時的狀態。"
      },
      {
        "name": ":nth-child()",
        "description": "依照元素在父層中的順序選取。"
      },
      {
        "name": "::before / ::after",
        "description": "在內容前後生成裝飾內容。"
      }
    ],
    "example": {
      "title": "狀態與裝飾",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<h2 class=\"title\">互動按鈕</h2>\n<button>移入我</button>",
      "preview": "<h2 class=\"title\">互動按鈕</h2>\n<button>移入我</button>"
    },
    "practice": {
      "instructions": "用 :nth-child() 做出表格隔行變色，再用 ::after 為必填欄位加上紅色星號。",
      "starterCode": {
        "html": "<table>\n  <tr>\n    <td>HTML</td>\n  </tr>\n  <tr>\n    <td>CSS</td>\n  </tr>\n  <tr>\n    <td>JavaScript</td>\n  </tr>\n</table>\n<label class=\"required\">Email</label>",
        "css": "",
        "js": ""
      },
      "checklist": [
        "我使用了 :hover",
        "我能說明 :before 與 :hover 的差異"
      ],
      "answer": {
        "html": "<table>\n  <tr>\n    <td>HTML</td>\n  </tr>\n  <tr>\n    <td>CSS</td>\n  </tr>\n  <tr>\n    <td>JavaScript</td>\n  </tr>\n</table>\n<label class=\"required\">Email</label>",
        "css": "tr:nth-child(even)  {\n   background: #eef0ff;\n}\n.required::after  {\n   content: \" *\";\n   color: #e76f8f;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "2-6",
    "number": 6,
    "stage": 2,
    "type": "CSS",
    "title": "盒模型與 box-sizing",
    "objective": "理解 margin、border、padding 如何影響元素尺寸。",
    "introduction": "每個元素都可以想成一個盒子。內容、內距、邊框和外距共同決定它在頁面上佔用的空間。",
    "concepts": [
      {
        "name": "content",
        "description": "元素真正放置文字或子元素的區域。"
      },
      {
        "name": "padding",
        "description": "內容與邊框之間的內側空間。"
      },
      {
        "name": "border",
        "description": "包住元素的邊線。"
      },
      {
        "name": "margin",
        "description": "元素與其他元素之間的外側空間。"
      },
      {
        "name": "box-sizing",
        "description": "控制 width 是否包含 padding 與 border。"
      }
    ],
    "example": {
      "title": "卡片尺寸",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<div class=\"card\">盒模型卡片</div>",
      "preview": "<div class=\"card\">盒模型卡片</div>"
    },
    "practice": {
      "instructions": "修正一個因為 padding 與 border 導致跑版的卡片，讓它回到原本設計尺寸。",
      "starterCode": {
        "html": "<div class=\"card\">\n  <h2>課程卡片</h2>\n  <p>這張卡片目前尺寸跑掉了。</p>\n  <button>開始學習</button>\n</div>",
        "css": ".card  {\n   width: 280px;\n   padding: 24px;\n   border: 8px solid #5268e6;\n}\nbutton  {\n   padding: 8px 14px;\n}",
        "js": ""
      },
      "checklist": [
        "我有設定 box-sizing",
        "卡片沒有超出指定尺寸"
      ],
      "answer": {
        "html": "<div class=\"card\">\n  <h2>課程卡片</h2>\n  <p>這張卡片尺寸固定且不會跑版。</p>\n  <button>開始學習</button>\n</div>",
        "css": ".card  {\n   box-sizing: border-box;\n   width: 280px;\n   padding: 24px;\n   border: 8px solid #5268e6;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "2-7",
    "number": 7,
    "stage": 2,
    "type": "CSS",
    "title": "文字排版",
    "objective": "用字級、行高與字距改善內容的閱讀體驗。",
    "introduction": "文字排版不只是調整大小，也包含行距、字距和粗細。好的排版能讓讀者更輕鬆閱讀內容。",
    "concepts": [
      {
        "name": "font-size",
        "description": "設定文字大小。"
      },
      {
        "name": "line-height",
        "description": "設定每一行文字的高度。"
      },
      {
        "name": "letter-spacing",
        "description": "調整字元之間的距離。"
      },
      {
        "name": "font-weight",
        "description": "設定文字粗細。"
      }
    ],
    "example": {
      "title": "舒適的文章",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<article>\n  <h2>一段好讀的文字</h2>\n  <p>適當的行高與字距，可以讓讀者更容易閱讀長篇內容。</p>\n</article>",
      "preview": "<article>\n  <h2>一段好讀的文字</h2>\n  <p>適當的行高與字距，可以讓讀者更容易閱讀長篇內容。</p>\n</article>"
    },
    "practice": {
      "instructions": "調整一篇文章的 font-size、line-height、letter-spacing 與 font-weight，達到指定的可讀性效果。",
      "starterCode": {
        "html": "<article>\n  <h1>如何開始學習程式設計</h1>\n  <p>學習程式設計需要練習，也需要閱讀與整理筆記。請調整這篇文章的排版，讓內容更容易閱讀。</p>\n</article>",
        "css": "article  {\n   max-width: 420px;\n}\nh1  {\n   font-weight: 400;\n}\np  {\n   font-size: 14px;\n}",
        "js": ""
      },
      "checklist": [
        "段落有適當的 line-height",
        "標題與內文有清楚層次"
      ],
      "answer": {
        "html": "<article>\n  <h1>如何開始學習程式設計</h1>\n  <p>學習程式設計需要練習，也需要閱讀與整理筆記。舒適的排版能讓內容更容易閱讀。</p>\n</article>",
        "css": "article  {\n   max-width: 420px;\n}\nh1  {\n   font-size: 28px;\n   font-weight: 700;\n}\np  {\n   font-size: 16px;\n   line-height: 1.9;\n   letter-spacing: .5px;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "2-8",
    "number": 8,
    "stage": 2,
    "type": "CSS",
    "title": "色彩與背景",
    "objective": "使用純色、漸層與背景圖片建立視覺氛圍。",
    "introduction": "背景可以使用單色、圖片或漸層。漸層是從一種顏色平滑變化到另一種顏色的背景效果。",
    "concepts": [
      {
        "name": "color",
        "description": "設定文字顏色。"
      },
      {
        "name": "background-color",
        "description": "設定元素的背景色。"
      },
      {
        "name": "background-image",
        "description": "設定背景圖片或漸層。"
      },
      {
        "name": "linear-gradient()",
        "description": "建立線性漸層。"
      }
    ],
    "example": {
      "title": "天空漸層",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<section class=\"sky\">\n  <h2>美好的一天</h2>\n</section>",
      "preview": "<section class=\"sky\">\n  <h2>美好的一天</h2>\n</section>"
    },
    "practice": {
      "instructions": "使用 linear-gradient 做出天空到日落的背景效果，並讓文字在背景上清楚可讀。",
      "starterCode": {
        "html": "<section class=\"sunset\">\n  <h2>今日風景</h2>\n  <p>把背景做成天空與夕陽的漸層。</p>\n</section>",
        "css": ".sunset  {\n   height: 180px;\n   padding: 24px;\n   color: white;\n}",
        "js": ""
      },
      "checklist": [
        "我有使用 background 或 background-color",
        "漸層至少有兩種顏色"
      ],
      "answer": {
        "html": "<section class=\"sunset\">\n  <h2>今日風景</h2>\n  <p>天空與夕陽交會的時刻。</p>\n</section>",
        "css": ".sunset  {\n   height: 180px;\n   padding: 24px;\n   color: white;\n   background: linear-gradient(#5b8def, #f19b9b);\n}",
        "js": ""
      }
    }
  },
  {
    "id": "3-9",
    "number": 9,
    "stage": 3,
    "type": "CSS",
    "title": "圓角 border-radius",
    "objective": "用圓角創造卡片、圓形與膠囊按鈕。",
    "introduction": "border-radius 可以讓方形元素變得柔和，也能做出圓形、膠囊和不對稱的視覺造型。",
    "concepts": [
      {
        "name": "border-radius",
        "description": "設定元素四個角的圓角程度。"
      },
      {
        "name": "50%",
        "description": "在正方形上可做出正圓形。"
      },
      {
        "name": "999px",
        "description": "常用來製作膠囊形按鈕。"
      }
    ],
    "example": {
      "title": "圓角造型",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<div class=\"shapes\">\n  <span>卡片</span>\n  <span>圓形</span>\n  <span>膠囊</span>\n</div>",
      "preview": "<div class=\"shapes\">\n  <span>卡片</span>\n  <span>圓形</span>\n  <span>膠囊</span>\n</div>"
    },
    "practice": {
      "instructions": "從圓角矩形延伸做出正圓形、膠囊按鈕與不對稱造型。",
      "starterCode": {
        "html": "<div class=\"gallery\">\n  <div>作品一</div>\n  <div>作品二</div>\n  <button>查看作品</button>\n</div>",
        "css": ".gallery  {\n   display: flex;\n   gap: 10px;\n}\n.gallery div, .gallery button  {\n   padding: 20px;\n   background: #dfe4ff;\n}",
        "js": ""
      },
      "checklist": [
        "我能使用不同 border-radius 值",
        "圓形的寬高相同"
      ],
      "answer": {
        "html": "<div class=\"gallery\">\n  <div>作品一</div>\n  <div class=\"circle\">作品二</div>\n  <button>查看作品</button>\n</div>",
        "css": ".gallery  {\n   display: flex;\n   gap: 10px;\n   align-items: center;\n}\n.gallery div, .gallery button  {\n   padding: 20px;\n   background: #dfe4ff;\n   border-radius: 14px;\n}\n.circle  {\n   border-radius: 50% !important;\n}\n.gallery button  {\n   border-radius: 999px;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "3-10",
    "number": 10,
    "stage": 3,
    "type": "CSS",
    "title": "陰影 box-shadow / text-shadow",
    "objective": "使用陰影製造浮起、凹陷與立體層次。",
    "introduction": "陰影能讓平面的介面產生深度。box-shadow 作用在盒子，text-shadow 則作用在文字。",
    "concepts": [
      {
        "name": "offset-x / y",
        "description": "控制陰影向左右、上下偏移。"
      },
      {
        "name": "blur",
        "description": "控制陰影邊緣的模糊程度。"
      },
      {
        "name": "spread",
        "description": "控制陰影擴張或縮小。"
      },
      {
        "name": "inset",
        "description": "將陰影放到元素內側。"
      }
    ],
    "example": {
      "title": "浮起的卡片",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<div class=\"card\">\n  <strong>設計靈感</strong>\n  <p>陰影讓元素有了空間感。</p>\n</div>",
      "preview": "<div class=\"card\">\n  <strong>設計靈感</strong>\n  <p>陰影讓元素有了空間感。</p>\n</div>"
    },
    "practice": {
      "instructions": "做出按下去的凹陷按鈕，並用多層 box-shadow 製作立體效果。",
      "starterCode": {
        "html": "<button class=\"press\">按下看看</button>\n<div class=\"stack\">立體卡片</div>",
        "css": ".press  {\n   padding: 12px 20px;\n   border: 0;\n   border-radius: 8px;\n}\n.stack  {\n   margin-top: 20px;\n   padding: 25px;\n   background: white;\n}",
        "js": ""
      },
      "checklist": [
        "我設定了 offset 與 blur",
        "陰影顏色不會太濃"
      ],
      "answer": {
        "html": "<button class=\"press\">按下看看</button>\n<div class=\"stack\">立體卡片</div>",
        "css": ".press  {\n   padding: 12px 20px;\n   border: 0;\n   border-radius: 8px;\n   box-shadow: 0 5px 0 #394aa3;\n}\n.press:active  {\n   transform: translateY(4px);\n   box-shadow: 0 1px 0 #394aa3;\n}\n.stack  {\n   margin-top: 20px;\n   padding: 25px;\n   background: white;\n   box-shadow: 0 8px 0 #c5ccef, 0 15px 25px #23345c33;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "3-11",
    "number": 11,
    "stage": 3,
    "type": "CSS",
    "title": "毛玻璃特效 backdrop-filter",
    "objective": "理解半透明背景與 blur 如何產生毛玻璃效果。",
    "introduction": "毛玻璃效果需要半透明背景和可被模糊的背景內容，兩者搭配才能看出玻璃質感。",
    "concepts": [
      {
        "name": "backdrop-filter",
        "description": "對元素後方的內容套用濾鏡。"
      },
      {
        "name": "blur()",
        "description": "將背景內容模糊。"
      },
      {
        "name": "rgba / #RRGGBBAA",
        "description": "建立帶有透明度的背景色。"
      }
    ],
    "example": {
      "title": "玻璃卡片",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<div class=\"scene\">\n  <div class=\"glass\">\n    <h2>Glassmorphism</h2>\n    <p>透過背景模糊創造層次。</p>\n  </div>\n</div>",
      "preview": "<div class=\"scene\">\n  <div class=\"glass\">\n    <h2>Glassmorphism</h2>\n    <p>透過背景模糊創造層次。</p>\n  </div>\n</div>"
    },
    "practice": {
      "instructions": "在背景圖或漸層上疊出毛玻璃導覽列，調整 blur 與半透明色的質感。",
      "starterCode": {
        "html": "<div class=\"background\">\n  <nav class=\"nav\">首頁　課程　作品　聯絡</nav>\n  <div class=\"glass\">探索我的作品集</div>\n</div>",
        "css": ".background  {\n   min-height: 180px;\n   padding: 25px;\n   background: linear-gradient(135deg,#5268e6,#e47eaa);\n}\n.nav, .glass  {\n   color: white;\n   padding: 14px;\n}",
        "js": ""
      },
      "checklist": [
        "背景有半透明色",
        "我有使用 backdrop-filter: blur"
      ],
      "answer": {
        "html": "<div class=\"background\">\n  <nav class=\"nav\">首頁　課程　作品　聯絡</nav>\n  <div class=\"glass\">探索我的作品集</div>\n</div>",
        "css": ".background  {\n   min-height: 180px;\n   padding: 25px;\n   background: linear-gradient(135deg,#5268e6,#e47eaa);\n}\n.nav, .glass  {\n   color: white;\n   padding: 14px;\n   background: #ffffff33;\n   backdrop-filter: blur(10px);\n   border: 1px solid #ffffff66;\n   border-radius: 12px;\n}\n.glass  {\n   margin-top: 25px;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "3-12",
    "number": 12,
    "stage": 3,
    "type": "CSS",
    "title": "transform 變形",
    "objective": "用 translate、rotate、scale 與 origin 製造動態感。",
    "introduction": "transform 可以在不影響其他元素排版的情況下移動、旋轉或縮放元素，是製作互動效果的重要工具。",
    "concepts": [
      {
        "name": "translate",
        "description": "移動元素的位置。"
      },
      {
        "name": "rotate",
        "description": "旋轉元素。"
      },
      {
        "name": "scale",
        "description": "放大或縮小元素。"
      },
      {
        "name": "transform-origin",
        "description": "設定變形發生的基準點。"
      }
    ],
    "example": {
      "title": "Hover 變形卡片",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<div class=\"card\">移入看看</div>",
      "preview": "<div class=\"card\">移入看看</div>"
    },
    "practice": {
      "instructions": "使用 transform 與 transform-origin 做出翻牌效果或傾斜的相片牆。",
      "starterCode": {
        "html": "<div class=\"scene\">\n  <div class=\"photo\">前面</div>\n  <div class=\"photo back\">背面</div>\n</div>",
        "css": ".scene  {\n   position: relative;\n   width: 150px;\n   height: 110px;\n}\n.photo  {\n   position: absolute;\n   padding: 40px 30px;\n   background: #dfe4ff;\n}",
        "js": ""
      },
      "checklist": [
        "我有使用 transform",
        "變化有 transition 過渡"
      ],
      "answer": {
        "html": "<div class=\"scene\">\n  <div class=\"photo\">前面</div>\n  <div class=\"photo back\">背面</div>\n</div>",
        "css": ".scene  {\n   position: relative;\n   width: 150px;\n   height: 110px;\n   perspective: 600px;\n}\n.photo  {\n   position: absolute;\n   padding: 40px 30px;\n   background: #dfe4ff;\n   transition: transform .5s;\n   backface-visibility: hidden;\n}\n.back  {\n   transform: rotateY(180deg);\n}\n.scene:hover .photo  {\n   transform: rotateY(180deg);\n}\n.scene:hover .back  {\n   transform: rotateY(360deg);\n}",
        "js": ""
      }
    }
  },
  {
    "id": "4-13",
    "number": 13,
    "stage": 4,
    "type": "CSS",
    "title": "Flexbox 排版",
    "objective": "使用一維排版對齊導覽列與卡片欄位。",
    "introduction": "Flexbox 是一維排版工具，適合處理同一列或同一欄中的對齊、間距和換行。",
    "concepts": [
      {
        "name": "display: flex",
        "description": "把元素容器變成 Flex 容器。"
      },
      {
        "name": "justify-content",
        "description": "控制主軸方向的排列方式。"
      },
      {
        "name": "align-items",
        "description": "控制交叉軸方向的對齊。"
      },
      {
        "name": "flex-wrap",
        "description": "內容太窄時是否換行。"
      }
    ],
    "example": {
      "title": "三欄卡片",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<div class=\"row\">\n  <div>HTML</div>\n  <div>CSS</div>\n  <div>JS</div>\n</div>",
      "preview": "<div class=\"row\">\n  <div>HTML</div>\n  <div>CSS</div>\n  <div>JS</div>\n</div>"
    },
    "practice": {
      "instructions": "使用 Flexbox 做出置中卡片與等分三欄排版，並處理小螢幕換行。",
      "starterCode": {
        "html": "<nav class=\"nav\">\n  <strong>WebCraft</strong>\n  <div>\n    <a>課程</a>\n    <a>練習</a>\n    <a>關於</a>\n  </div>\n</nav>\n<section class=\"cards\">\n  <div>HTML</div>\n  <div>CSS</div>\n  <div>JavaScript</div>\n</section>",
        "css": ".nav  {\n   padding: 14px;\n   background: #eef0ff;\n}\n.cards div  {\n   padding: 25px;\n   background: #dfe4ff;\n}",
        "js": ""
      },
      "checklist": [
        "容器有 display:flex",
        "三個欄位寬度相等"
      ],
      "answer": {
        "html": "<nav class=\"nav\">\n  <strong>WebCraft</strong>\n  <div>\n    <a>課程</a>\n    <a>練習</a>\n    <a>關於</a>\n  </div>\n</nav>\n<section class=\"cards\">\n  <div>HTML</div>\n  <div>CSS</div>\n  <div>JavaScript</div>\n</section>",
        "css": ".nav, .cards  {\n   display: flex;\n   gap: 16px;\n}\n.nav  {\n   justify-content: space-between;\n   align-items: center;\n   padding: 14px;\n   background: #eef0ff;\n}\n.cards  {\n   flex-wrap: wrap;\n}\n.cards div  {\n   flex: 1;\n   min-width: 120px;\n   padding: 25px;\n   background: #dfe4ff;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "4-14",
    "number": 14,
    "stage": 4,
    "type": "CSS",
    "title": "transition 過渡動畫",
    "objective": "讓 hover 或 class 狀態的變化平滑呈現。",
    "introduction": "transition 讓 CSS 屬性改變時有平滑的過程，常和 hover、focus 或 class 切換一起使用。",
    "concepts": [
      {
        "name": "transition-property",
        "description": "指定哪些屬性要有過渡效果。"
      },
      {
        "name": "duration",
        "description": "設定變化需要多久。"
      },
      {
        "name": "timing-function",
        "description": "控制變化速度曲線。"
      }
    ],
    "example": {
      "title": "平滑按鈕",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<button class=\"smooth\">移入我</button>",
      "preview": "<button class=\"smooth\">移入我</button>"
    },
    "practice": {
      "instructions": "用 transition 做出手風琴展開與收合的平滑動畫。",
      "starterCode": {
        "html": "<div class=\"faq\">\n  <button>什麼是 HTML？</button>\n  <p>HTML 是網頁的結構。</p>\n  <button>什麼是 CSS？</button>\n  <p>CSS 負責網頁外觀。</p>\n</div>",
        "css": ".faq p  {\n   max-height: 0;\n   overflow: hidden;\n   margin: 0;\n}\n.faq button  {\n   display: block;\n   padding: 10px;\n}",
        "js": ""
      },
      "checklist": [
        "transition 寫在原始狀態",
        "變化不會瞬間跳動"
      ],
      "answer": {
        "html": "<div class=\"faq\">\n  <button>什麼是 HTML？</button>\n  <p>HTML 是網頁的結構。</p>\n  <button>什麼是 CSS？</button>\n  <p>CSS 負責網頁外觀。</p>\n</div>",
        "css": ".faq p  {\n   max-height: 0;\n   overflow: hidden;\n   margin: 0;\n   transition: max-height .3s, padding .3s;\n}\n.faq button  {\n   display: block;\n   padding: 10px;\n}\n.faq button:hover + p  {\n   max-height: 50px;\n   padding: 10px;\n}",
        "js": ""
      }
    }
  },
  {
    "id": "5-15",
    "number": 15,
    "stage": 5,
    "type": "JavaScript",
    "title": "DOM 選取與內容操作",
    "objective": "選取元素並用 JavaScript 更新文字與樣式。",
    "introduction": "DOM 是瀏覽器把 HTML 轉成的樹狀結構。JavaScript 可以選取其中的元素，並修改文字或內容。",
    "concepts": [
      {
        "name": "querySelector()",
        "description": "用 CSS 選擇器找出第一個元素。"
      },
      {
        "name": "textContent",
        "description": "讀取或修改純文字內容。"
      },
      {
        "name": "innerHTML",
        "description": "讀取或修改 HTML 內容。"
      },
      {
        "name": "style",
        "description": "直接修改元素的 inline style。"
      }
    ],
    "example": {
      "title": "點擊改變文字",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<p id=\"message\">還沒有按下按鈕</p>\n<button id=\"change\">點我</button>",
      "preview": "<p id=\"message\">還沒有按下按鈕</p>\n<button id=\"change\">點我</button>"
    },
    "practice": {
      "instructions": "使用 querySelector 與 textContent 做出簡易字數統計或即時預覽輸入內容。",
      "starterCode": {
        "html": "<label>留言內容</label>\n<textarea id=\"comment\">\n</textarea>\n<p>目前字數：<span id=\"count\">0</span>\n</p>",
        "css": "textarea  {\n   display: block;\n   width: 260px;\n   height: 80px;\n}",
        "js": "const input = document.querySelector(''#comment'')\nconst count = document.querySelector(''#count'')"
      },
      "checklist": [
        "我有使用 querySelector",
        "點擊後 textContent 會更新"
      ],
      "answer": {
        "html": "<label>留言內容</label>\n<textarea id=\"comment\">\n</textarea>\n<p>目前字數：<span id=\"count\">0</span>\n</p>",
        "css": "textarea  {\n   display: block;\n   width: 260px;\n   height: 80px;\n}",
        "js": "const input = document.querySelector(''#comment'')\nconst count = document.querySelector(''#count'')\ninput.addEventListener(''input'', () =>  {\n   count.textContent = input.value.length \n}\n)"
      }
    }
  },
  {
    "id": "5-16",
    "number": 16,
    "stage": 5,
    "type": "JavaScript",
    "title": "事件監聽 addEventListener",
    "objective": "掌握 click、input 等事件，讓頁面回應使用者。",
    "introduction": "事件是使用者或瀏覽器發生的動作，例如點擊、輸入和滑鼠移入。事件監聽器可以讓頁面回應這些動作。",
    "concepts": [
      {
        "name": "click",
        "description": "使用者點擊元素時觸發。"
      },
      {
        "name": "input",
        "description": "輸入欄位內容改變時觸發。"
      },
      {
        "name": "mouseenter",
        "description": "滑鼠移入元素時觸發。"
      },
      {
        "name": "event",
        "description": "包含這次事件相關資訊的物件。"
      }
    ],
    "example": {
      "title": "即時輸入預覽",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<input id=\"name\" placeholder=\"輸入名字\">\n<p>你好，<span id=\"output\">訪客</span>！</p>",
      "preview": "<input id=\"name\" placeholder=\"輸入名字\">\n<p>你好，<span id=\"output\">訪客</span>！</p>"
    },
    "practice": {
      "instructions": "使用 click、mouseenter、mouseleave 或 input 事件，完成開關燈效果或表單即時驗證。",
      "starterCode": {
        "html": "<button id=\"light\">開關燈</button>\n<div id=\"room\">房間</div>",
        "css": "#room  {\n   width: 180px;\n   padding: 45px 20px;\n   background: #273149;\n   color: white;\n}",
        "js": "document.querySelector(''#light'').addEventListener(''click'', () =>  {\n\n  document.querySelector(''#room'').classList.toggle(''on'')\n\n}\n)"
      },
      "checklist": [
        "我有監聽 input 事件",
        "空值時仍有預設文字"
      ],
      "answer": {
        "html": "<button id=\"light\">開關燈</button>\n<div id=\"room\">房間</div>",
        "css": "#room  {\n   width: 180px;\n   padding: 45px 20px;\n   background: #273149;\n   color: white;\n}\n#room.on  {\n   background: #ffe28a;\n   color: #172033;\n}",
        "js": "document.querySelector(''#light'').addEventListener(''click'', () =>  {\n\n  document.querySelector(''#room'').classList.toggle(''on'')\n\n}\n)"
      }
    }
  },
  {
    "id": "5-17",
    "number": 17,
    "stage": 5,
    "type": "JavaScript",
    "title": "動態增刪元素與 classList",
    "objective": "建立元素、加入清單並切換深色模式。",
    "introduction": "最後把前面學到的 DOM、事件與 CSS 狀態結合起來，動態建立元素、刪除項目並切換頁面模式。",
    "concepts": [
      {
        "name": "createElement()",
        "description": "建立新的 HTML 元素。"
      },
      {
        "name": "appendChild()",
        "description": "把元素加入另一個元素裡。"
      },
      {
        "name": "remove()",
        "description": "從頁面移除元素。"
      },
      {
        "name": "classList.toggle()",
        "description": "切換元素是否具有某個 class。"
      }
    ],
    "example": {
      "title": "待辦清單",
      "description": "先觀察完整範例的結構，再到下方編輯器動手修改。",
      "code": "<input id=\"todo\" placeholder=\"新增待辦\">\n<button id=\"add\">新增</button>\n<ul id=\"list\">\n</ul>",
      "preview": "<input id=\"todo\" placeholder=\"新增待辦\">\n<button id=\"add\">新增</button>\n<ul id=\"list\">\n</ul>"
    },
    "practice": {
      "instructions": "完成可新增、刪除待辦事項的清單，再加入 classList.toggle 實作深色模式。",
      "starterCode": {
        "html": "<input id=\"todo\" placeholder=\"新增待辦\">\n<button id=\"add\">新增</button>\n<ul id=\"list\">\n  <li>完成 HTML 練習 <button>刪除</button>\n</li>\n</ul>",
        "css": "body  {\n   transition: .3s;\n}\n.dark  {\n   background: #172033;\n   color: white;\n}",
        "js": "const list = document.querySelector(''#list'')\nconst add = document.querySelector(''#add'')"
      },
      "checklist": [
        "我有使用 createElement 與 appendChild",
        "新增後輸入框會清空"
      ],
      "answer": {
        "html": "<input id=\"todo\" placeholder=\"新增待辦\">\n<button id=\"add\">新增</button>\n<button id=\"theme\">深色模式</button>\n<ul id=\"list\">\n  <li>完成 HTML 練習 <button class=\"remove\">刪除</button>\n</li>\n</ul>",
        "css": "body  {\n   transition: .3s;\n}\n.dark  {\n   background: #172033;\n   color: white;\n}",
        "js": "const list = document.querySelector(''#list'')\nconst add = document.querySelector(''#add'')\nconst input = document.querySelector(''#todo'')\nadd.addEventListener(''click'', () =>  {\n\n  if (!input.value) return\n  const li = document.createElement(''li'')\n  li.append(document.createTextNode(input.value + '' ''))\n  const remove = document.createElement(''button'')\n  remove.className = ''remove''\n  remove.textContent = ''刪除''\n  remove.addEventListener(''click'', () => li.remove())\n  li.appendChild(remove)\n  list.appendChild(li)\n  input.value = ''''\n\n}\n)\ndocument.querySelector(''#theme'').addEventListener(''click'', () => document.body.classList.toggle(''dark''))"
      }
    }
  }
]'::jsonb,
  now()
)
ON CONFLICT (id) DO UPDATE SET
  stages = EXCLUDED.stages,
  lessons = EXCLUDED.lessons,
  updated_at = now();
