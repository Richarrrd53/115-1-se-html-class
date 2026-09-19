export type Code = { html: string; css: string; js: string }
export type Concept = { name: string; description: string }
export type Stage = { id: number; title: string }
export type Lesson = {
  id: string; number: number; stage: number; type: string; title: string; objective: string
  introduction: string; concepts: Concept[]
  example: { title: string; description: string; code: string; preview: string }
  practice: { instructions: string; starterCode: Code; checklist: string[]; answer: Code }
}

export const stages: Stage[] = [
  { id: 1, title: '階段一 · HTML 基礎' }, { id: 2, title: '階段二 · CSS 基礎' },
  { id: 3, title: '階段三 · CSS 視覺效果' }, { id: 4, title: '階段四 · 排版與動態' }, { id: 5, title: '階段五 · JavaScript' },
]


const code = (html: string, css = '', js = ''): Code => ({ html, css, js })
const introductions: Record<number, { text: string; concepts: Concept[] }> = {
  1: { text: 'HTML 語意化標籤像是文章的骨架，讓瀏覽器、搜尋引擎和使用者都更容易理解頁面結構。', concepts: [{ name: '<header>', description: '頁面或區塊的標題區域。' }, { name: '<nav>', description: '放置主要導覽連結。' }, { name: '<main>', description: '頁面最主要、獨特的內容。' }, { name: '<article>', description: '可以獨立閱讀的文章內容。' }, { name: '<footer>', description: '頁尾或區塊的補充資訊。' }] },
  2: { text: '清單適合整理項目，表格適合呈現有欄列關係的資料。先判斷資料的關係，再選擇合適的標籤。', concepts: [{ name: '<ul>', description: '無順序清單，項目通常以圓點呈現。' }, { name: '<ol>', description: '有順序清單，項目會以編號呈現。' }, { name: '<li>', description: '清單中的單一項目。' }, { name: '<table>', description: '用來呈現列與欄的資料。' }, { name: '<th> / <td>', description: '欄位標題與一般資料儲存格。' }] },
  3: { text: '表單是網頁收集使用者資料的方式。每個輸入欄位都應該有清楚的標籤與合適的輸入類型。', concepts: [{ name: '<form>', description: '包住整組表單控制項。' }, { name: '<label>', description: '說明輸入欄位的用途。' }, { name: 'for / id', description: '把標籤和對應欄位連結起來。' }, { name: 'type', description: '指定文字、Email、密碼等輸入類型。' }, { name: 'required', description: '要求欄位不可留白。' }] },
  4: { text: 'CSS 選擇器決定「要套用誰」，特異度則決定「衝突時誰優先」。理解這個規則，就能更有系統地除錯樣式。', concepts: [{ name: 'element', description: '直接選取 HTML 元素，例如 p。' }, { name: '.class', description: '選取一群具有相同分類的元素。' }, { name: '#id', description: '選取具有特定唯一 id 的元素。' }, { name: '後代選擇器', description: '選取某個元素裡面的後代元素。' }] },
  5: { text: '偽類描述元素的狀態或位置；偽元素則能在元素前後產生裝飾內容。', concepts: [{ name: ':hover', description: '滑鼠移入元素時的狀態。' }, { name: ':focus', description: '輸入欄位取得焦點時的狀態。' }, { name: ':nth-child()', description: '依照元素在父層中的順序選取。' }, { name: '::before / ::after', description: '在內容前後生成裝飾內容。' }] },
  6: { text: '每個元素都可以想成一個盒子。內容、內距、邊框和外距共同決定它在頁面上佔用的空間。', concepts: [{ name: 'content', description: '元素真正放置文字或子元素的區域。' }, { name: 'padding', description: '內容與邊框之間的內側空間。' }, { name: 'border', description: '包住元素的邊線。' }, { name: 'margin', description: '元素與其他元素之間的外側空間。' }, { name: 'box-sizing', description: '控制 width 是否包含 padding 與 border。' }] },
  7: { text: '文字排版不只是調整大小，也包含行距、字距和粗細。好的排版能讓讀者更輕鬆閱讀內容。', concepts: [{ name: 'font-size', description: '設定文字大小。' }, { name: 'line-height', description: '設定每一行文字的高度。' }, { name: 'letter-spacing', description: '調整字元之間的距離。' }, { name: 'font-weight', description: '設定文字粗細。' }] },
  8: { text: '背景可以使用單色、圖片或漸層。漸層是從一種顏色平滑變化到另一種顏色的背景效果。', concepts: [{ name: 'color', description: '設定文字顏色。' }, { name: 'background-color', description: '設定元素的背景色。' }, { name: 'background-image', description: '設定背景圖片或漸層。' }, { name: 'linear-gradient()', description: '建立線性漸層。' }] },
  9: { text: 'border-radius 可以讓方形元素變得柔和，也能做出圓形、膠囊和不對稱的視覺造型。', concepts: [{ name: 'border-radius', description: '設定元素四個角的圓角程度。' }, { name: '50%', description: '在正方形上可做出正圓形。' }, { name: '999px', description: '常用來製作膠囊形按鈕。' }] },
  10: { text: '陰影能讓平面的介面產生深度。box-shadow 作用在盒子，text-shadow 則作用在文字。', concepts: [{ name: 'offset-x / y', description: '控制陰影向左右、上下偏移。' }, { name: 'blur', description: '控制陰影邊緣的模糊程度。' }, { name: 'spread', description: '控制陰影擴張或縮小。' }, { name: 'inset', description: '將陰影放到元素內側。' }] },
  11: { text: '毛玻璃效果需要半透明背景和可被模糊的背景內容，兩者搭配才能看出玻璃質感。', concepts: [{ name: 'backdrop-filter', description: '對元素後方的內容套用濾鏡。' }, { name: 'blur()', description: '將背景內容模糊。' }, { name: 'rgba / #RRGGBBAA', description: '建立帶有透明度的背景色。' }] },
  12: { text: 'transform 可以在不影響其他元素排版的情況下移動、旋轉或縮放元素，是製作互動效果的重要工具。', concepts: [{ name: 'translate', description: '移動元素的位置。' }, { name: 'rotate', description: '旋轉元素。' }, { name: 'scale', description: '放大或縮小元素。' }, { name: 'transform-origin', description: '設定變形發生的基準點。' }] },
  13: { text: 'Flexbox 是一維排版工具，適合處理同一列或同一欄中的對齊、間距和換行。', concepts: [{ name: 'display: flex', description: '把元素容器變成 Flex 容器。' }, { name: 'justify-content', description: '控制主軸方向的排列方式。' }, { name: 'align-items', description: '控制交叉軸方向的對齊。' }, { name: 'flex-wrap', description: '內容太窄時是否換行。' }] },
  14: { text: 'transition 讓 CSS 屬性改變時有平滑的過程，常和 hover、focus 或 class 切換一起使用。', concepts: [{ name: 'transition-property', description: '指定哪些屬性要有過渡效果。' }, { name: 'duration', description: '設定變化需要多久。' }, { name: 'timing-function', description: '控制變化速度曲線。' }] },
  15: { text: 'DOM 是瀏覽器把 HTML 轉成的樹狀結構。JavaScript 可以選取其中的元素，並修改文字或內容。', concepts: [{ name: 'querySelector()', description: '用 CSS 選擇器找出第一個元素。' }, { name: 'textContent', description: '讀取或修改純文字內容。' }, { name: 'innerHTML', description: '讀取或修改 HTML 內容。' }, { name: 'style', description: '直接修改元素的 inline style。' }] },
  16: { text: '事件是使用者或瀏覽器發生的動作，例如點擊、輸入和滑鼠移入。事件監聽器可以讓頁面回應這些動作。', concepts: [{ name: 'click', description: '使用者點擊元素時觸發。' }, { name: 'input', description: '輸入欄位內容改變時觸發。' }, { name: 'mouseenter', description: '滑鼠移入元素時觸發。' }, { name: 'event', description: '包含這次事件相關資訊的物件。' }] },
  17: { text: '最後把前面學到的 DOM、事件與 CSS 狀態結合起來，動態建立元素、刪除項目並切換頁面模式。', concepts: [{ name: 'createElement()', description: '建立新的 HTML 元素。' }, { name: 'appendChild()', description: '把元素加入另一個元素裡。' }, { name: 'remove()', description: '從頁面移除元素。' }, { name: 'classList.toggle()', description: '切換元素是否具有某個 class。' }] },
}
const formatCode = (value: string, type: keyof Code) => {
  const normalized = value.replace(/\\n/g, '\n').trim()
  if (type === 'html') {
    const lines = normalized
      .replace(/></g, '>\n<')
      .replace(/^\s+|\s+$/g, '')
      .split('\n')
    let depth = 0
    const voidTags = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i
    return lines.map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('</')) depth = Math.max(0, depth - 1)
      const formatted = `${'  '.repeat(depth)}${trimmed}`
      if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!') &&
        !trimmed.includes('</') && !trimmed.endsWith('/>') && !voidTags.test(trimmed.slice(1))) depth += 1
      return formatted
    }).join('\n')
  }
  if (type === 'css') {
    return normalized
      .replace(/\{/g, ' {\n  ')
      .replace(/;/g, ';\n  ')
      .replace(/\}/g, '\n}\n')
      .replace(/\n\s*\n/g, '\n')
      .replace(/  \n/g, '\n')
      .trim()
  }
  return normalized
    .replace(/\{/g, ' {\n  ')
    .replace(/;/g, ';\n  ')
    .replace(/\}/g, '\n}\n')
    .replace(/  \n/g, '\n')
    .trim()
}
const formatCodeSet = (value: Code): Code => ({
  html: formatCode(value.html, 'html'),
  css: formatCode(value.css, 'css'),
  js: formatCode(value.js, 'js'),
})
const challengeInstructions: Record<number, string> = {
  1: '把一份全部使用 div 的部落格頁面，改寫成 header、nav、main、section、article、footer 的語意化結構。',
  2: '把一份 Excel 截圖的課程資料轉成正確的 HTML table，並補上表格標題與欄位標題。',
  3: '在報名表單的基礎上，做出登入表單與意見回饋表單，練習不同 input type。',
  4: '找出顏色套用錯誤的規則，利用 class、id 與後代選擇器修正按鈕樣式。',
  5: '用 :nth-child() 做出表格隔行變色，再用 ::after 為必填欄位加上紅色星號。',
  6: '修正一個因為 padding 與 border 導致跑版的卡片，讓它回到原本設計尺寸。',
  7: '調整一篇文章的 font-size、line-height、letter-spacing 與 font-weight，達到指定的可讀性效果。',
  8: '使用 linear-gradient 做出天空到日落的背景效果，並讓文字在背景上清楚可讀。',
  9: '從圓角矩形延伸做出正圓形、膠囊按鈕與不對稱造型。',
  10: '做出按下去的凹陷按鈕，並用多層 box-shadow 製作立體效果。',
  11: '在背景圖或漸層上疊出毛玻璃導覽列，調整 blur 與半透明色的質感。',
  12: '使用 transform 與 transform-origin 做出翻牌效果或傾斜的相片牆。',
  13: '使用 Flexbox 做出置中卡片與等分三欄排版，並處理小螢幕換行。',
  14: '用 transition 做出手風琴展開與收合的平滑動畫。',
  15: '使用 querySelector 與 textContent 做出簡易字數統計或即時預覽輸入內容。',
  16: '使用 click、mouseenter、mouseleave 或 input 事件，完成開關燈效果或表單即時驗證。',
  17: '完成可新增、刪除待辦事項的清單，再加入 classList.toggle 實作深色模式。',
}

const challengeStarters: Record<number, Code> = {
  1: code('<div class="blog"><div class="top">我的部落格</div><div class="post"><h2>學習筆記</h2><p>今天認識了 HTML 結構。</p></div><div class="bottom">作者：小明</div></div>'),
  2: code('<h2>資管系課程</h2>\n<!-- 請將以下資料整理成 table -->\n<p>星期一｜軟體工程｜教室 A101</p>\n<p>星期三｜資料庫｜教室 B202</p>'),
  3: code('<form>\n  <label for="account">帳號</label><input id="account">\n  <label for="password">密碼</label><input id="password">\n  <button>登入</button>\n</form>'),
  4: code('<div class="panel"><button class="primary" id="save">儲存設定</button></div>', '.panel button { background: #f3b45d; padding: 10px; border: 0; }\n.primary { background: #5b8def; }\n#save { color: white; }'),
  5: code('<table><tr><td>HTML</td></tr><tr><td>CSS</td></tr><tr><td>JavaScript</td></tr></table>\n<label class="required">Email</label>'),
  6: code('<div class="card"><h2>課程卡片</h2><p>這張卡片目前尺寸跑掉了。</p><button>開始學習</button></div>', '.card { width: 280px; padding: 24px; border: 8px solid #5268e6; }\nbutton { padding: 8px 14px; }'),
  7: code('<article><h1>如何開始學習程式設計</h1><p>學習程式設計需要練習，也需要閱讀與整理筆記。請調整這篇文章的排版，讓內容更容易閱讀。</p></article>', 'article { max-width: 420px; }\nh1 { font-weight: 400; }\np { font-size: 14px; }'),
  8: code('<section class="sunset"><h2>今日風景</h2><p>把背景做成天空與夕陽的漸層。</p></section>', '.sunset { height: 180px; padding: 24px; color: white; }'),
  9: code('<div class="gallery"><div>作品一</div><div>作品二</div><button>查看作品</button></div>', '.gallery { display: flex; gap: 10px; }\n.gallery div, .gallery button { padding: 20px; background: #dfe4ff; }'),
  10: code('<button class="press">按下看看</button>\n<div class="stack">立體卡片</div>', '.press { padding: 12px 20px; border: 0; border-radius: 8px; }\n.stack { margin-top: 20px; padding: 25px; background: white; }'),
  11: code('<div class="background"><nav class="nav">首頁　課程　作品　聯絡</nav><div class="glass">探索我的作品集</div></div>', '.background { min-height: 180px; padding: 25px; background: linear-gradient(135deg,#5268e6,#e47eaa); }\n.nav, .glass { color: white; padding: 14px; }'),
  12: code('<div class="scene"><div class="photo">前面</div><div class="photo back">背面</div></div>', '.scene { position: relative; width: 150px; height: 110px; }\n.photo { position: absolute; padding: 40px 30px; background: #dfe4ff; }'),
  13: code('<nav class="nav"><strong>WebCraft</strong><div><a>課程</a><a>練習</a><a>關於</a></div></nav>\n<section class="cards"><div>HTML</div><div>CSS</div><div>JavaScript</div></section>', '.nav { padding: 14px; background: #eef0ff; }\n.cards div { padding: 25px; background: #dfe4ff; }'),
  14: code('<div class="faq"><button>什麼是 HTML？</button><p>HTML 是網頁的結構。</p><button>什麼是 CSS？</button><p>CSS 負責網頁外觀。</p></div>', '.faq p { max-height: 0; overflow: hidden; margin: 0; }\n.faq button { display: block; padding: 10px; }'),
  15: code('<label>留言內容</label><textarea id="comment"></textarea><p>目前字數：<span id="count">0</span></p>', 'textarea { display: block; width: 260px; height: 80px; }', "const input = document.querySelector('#comment')\nconst count = document.querySelector('#count')"),
  16: code('<button id="light">開關燈</button><div id="room">房間</div>', '#room { width: 180px; padding: 45px 20px; background: #273149; color: white; }', "document.querySelector('#light').addEventListener('click', () => {\n  document.querySelector('#room').classList.toggle('on')\n})"),
  17: code('<input id="todo" placeholder="新增待辦"><button id="add">新增</button><ul id="list"><li>完成 HTML 練習 <button>刪除</button></li></ul>', 'body { transition: .3s; }\n.dark { background: #172033; color: white; }', "const list = document.querySelector('#list')\nconst add = document.querySelector('#add')"),
}

const challengeAnswers: Record<number, Code> = {
  1: code('<header><h1>我的部落格</h1></header>\n<nav>首頁　文章　關於我</nav>\n<main><section><article><h2>學習筆記</h2><p>今天認識了 HTML 結構。</p></article></section></main>\n<footer>作者：小明</footer>'),
  2: code('<h2>資管系課程</h2>\n<table>\n  <caption>本週課程表</caption>\n  <tr><th>星期</th><th>課程</th><th>教室</th></tr>\n  <tr><td>星期一</td><td>軟體工程</td><td>A101</td></tr>\n  <tr><td>星期三</td><td>資料庫</td><td>B202</td></tr>\n</table>'),
  3: code('<form>\n  <label for="account">帳號</label><input id="account" required>\n  <label for="password">密碼</label><input id="password" type="password" required>\n  <label for="message">意見</label><textarea id="message"></textarea>\n  <button>送出</button>\n</form>'),
  4: code('<div class="panel"><button class="primary" id="save">儲存設定</button></div>', '.panel button { background: #f3b45d; }\n.panel .primary { background: #5b8def; }\n#save { background: #e76f8f; color: white; }'),
  5: code('<table><tr><td>HTML</td></tr><tr><td>CSS</td></tr><tr><td>JavaScript</td></tr></table>\n<label class="required">Email</label>', 'tr:nth-child(even) { background: #eef0ff; }\n.required::after { content: " *"; color: #e76f8f; }'),
  6: code('<div class="card"><h2>課程卡片</h2><p>這張卡片尺寸固定且不會跑版。</p><button>開始學習</button></div>', '.card { box-sizing: border-box; width: 280px; padding: 24px; border: 8px solid #5268e6; }'),
  7: code('<article><h1>如何開始學習程式設計</h1><p>學習程式設計需要練習，也需要閱讀與整理筆記。舒適的排版能讓內容更容易閱讀。</p></article>', 'article { max-width: 420px; }\nh1 { font-size: 28px; font-weight: 700; }\np { font-size: 16px; line-height: 1.9; letter-spacing: .5px; }'),
  8: code('<section class="sunset"><h2>今日風景</h2><p>天空與夕陽交會的時刻。</p></section>', '.sunset { height: 180px; padding: 24px; color: white; background: linear-gradient(#5b8def, #f19b9b); }'),
  9: code('<div class="gallery"><div>作品一</div><div class="circle">作品二</div><button>查看作品</button></div>', '.gallery { display: flex; gap: 10px; align-items: center; }\n.gallery div, .gallery button { padding: 20px; background: #dfe4ff; border-radius: 14px; }\n.circle { border-radius: 50% !important; }\n.gallery button { border-radius: 999px; }'),
  10: code('<button class="press">按下看看</button>\n<div class="stack">立體卡片</div>', '.press { padding: 12px 20px; border: 0; border-radius: 8px; box-shadow: 0 5px 0 #394aa3; }\n.press:active { transform: translateY(4px); box-shadow: 0 1px 0 #394aa3; }\n.stack { margin-top: 20px; padding: 25px; background: white; box-shadow: 0 8px 0 #c5ccef, 0 15px 25px #23345c33; }'),
  11: code('<div class="background"><nav class="nav">首頁　課程　作品　聯絡</nav><div class="glass">探索我的作品集</div></div>', '.background { min-height: 180px; padding: 25px; background: linear-gradient(135deg,#5268e6,#e47eaa); }\n.nav, .glass { color: white; padding: 14px; background: #ffffff33; backdrop-filter: blur(10px); border: 1px solid #ffffff66; border-radius: 12px; }\n.glass { margin-top: 25px; }'),
  12: code('<div class="scene"><div class="photo">前面</div><div class="photo back">背面</div></div>', '.scene { position: relative; width: 150px; height: 110px; perspective: 600px; }\n.photo { position: absolute; padding: 40px 30px; background: #dfe4ff; transition: transform .5s; backface-visibility: hidden; }\n.back { transform: rotateY(180deg); }\n.scene:hover .photo { transform: rotateY(180deg); }\n.scene:hover .back { transform: rotateY(360deg); }'),
  13: code('<nav class="nav"><strong>WebCraft</strong><div><a>課程</a><a>練習</a><a>關於</a></div></nav>\n<section class="cards"><div>HTML</div><div>CSS</div><div>JavaScript</div></section>', '.nav, .cards { display: flex; gap: 16px; }\n.nav { justify-content: space-between; align-items: center; padding: 14px; background: #eef0ff; }\n.cards { flex-wrap: wrap; }\n.cards div { flex: 1; min-width: 120px; padding: 25px; background: #dfe4ff; }'),
  14: code('<div class="faq"><button>什麼是 HTML？</button><p>HTML 是網頁的結構。</p><button>什麼是 CSS？</button><p>CSS 負責網頁外觀。</p></div>', '.faq p { max-height: 0; overflow: hidden; margin: 0; transition: max-height .3s, padding .3s; }\n.faq button { display: block; padding: 10px; }\n.faq button:hover + p { max-height: 50px; padding: 10px; }'),
  15: code('<label>留言內容</label><textarea id="comment"></textarea><p>目前字數：<span id="count">0</span></p>', 'textarea { display: block; width: 260px; height: 80px; }', "const input = document.querySelector('#comment')\nconst count = document.querySelector('#count')\ninput.addEventListener('input', () => { count.textContent = input.value.length })"),
  16: code('<button id="light">開關燈</button><div id="room">房間</div>', '#room { width: 180px; padding: 45px 20px; background: #273149; color: white; }\n#room.on { background: #ffe28a; color: #172033; }', "document.querySelector('#light').addEventListener('click', () => {\n  document.querySelector('#room').classList.toggle('on')\n})"),
  17: code('<input id="todo" placeholder="新增待辦"><button id="add">新增</button><button id="theme">深色模式</button><ul id="list"><li>完成 HTML 練習 <button class="remove">刪除</button></li></ul>', 'body { transition: .3s; }\n.dark { background: #172033; color: white; }', "const list = document.querySelector('#list')\nconst add = document.querySelector('#add')\nconst input = document.querySelector('#todo')\nadd.addEventListener('click', () => {\n  if (!input.value) return\n  const li = document.createElement('li')\n  li.append(document.createTextNode(input.value + ' '))\n  const remove = document.createElement('button')\n  remove.className = 'remove'\n  remove.textContent = '刪除'\n  remove.addEventListener('click', () => li.remove())\n  li.appendChild(remove)\n  list.appendChild(li)\n  input.value = ''\n})\ndocument.querySelector('#theme').addEventListener('click', () => document.body.classList.toggle('dark'))"),
}

const topics: [number, number, string, string, string, Code, string, string[], string][] = [
  [1, 1, '語意化標籤與文件結構', '用正確的 HTML 標籤搭出清楚的頁面骨架。', 'HTML 骨架範例', code('<header><h1>我的學習筆記</h1></header>\\n<nav>首頁　課程　關於我</nav>\\n<main><article><h2>今天學了語意化標籤</h2><p>讓內容更容易理解。</p></article></main>\\n<footer>© 2026 WebCraft</footer>', 'body{font-family:Arial;padding:20px} header{color:#3149d8} article{padding:16px;background:#eef0ff;border-radius:12px}'), '把 div 改成語意化標籤。', ['我使用了 header、nav、main、article、footer', '內容層級使用正確的標題'], '<header><h1>我的學習筆記</h1></header>\\n<nav>首頁　課程　關於我</nav>\\n<main><article><h2>文章標題</h2><p>文章內容</p></article></main>\\n<footer>© 2026</footer>'],
  [1, 2, '清單與表格', '理解清單與表格的資料結構及適用時機。', '課表與待辦清單', code('<h2>本週課表</h2><table><tr><th>星期</th><th>課程</th></tr><tr><td>一</td><td>軟體工程</td></tr></table>\\n<h2>待辦事項</h2><ol><li>預習 HTML</li><li>完成練習</li></ol>', 'table{border-collapse:collapse}th,td{border:1px solid #ccd;padding:8px}'), '將課程資料整理成表格，並補上待辦清單。', ['表格有使用 th 表示標題', '清單項目都放在 li 裡'], '<table><tr><th>星期</th><th>課程</th></tr><tr><td>一</td><td>軟體工程</td></tr></table>\\n<ol><li>預習 HTML</li><li>完成練習</li></ol>'],
  [1, 3, '表單與輸入元素', '使用 label、input 與驗證屬性建立友善表單。', '報名表單', code('<form><label for="name">姓名</label><input id="name" required placeholder="請輸入姓名"><label for="email">Email</label><input id="email" type="email" required><button>送出報名</button></form>', 'form{display:grid;gap:8px;max-width:260px}input{padding:8px;border:1px solid #ccd;border-radius:6px}button{padding:8px;background:#5268e6;color:white;border:0;border-radius:6px}'), '製作一個包含姓名、Email 和送出按鈕的表單。', ['每個 input 都有對應的 label', '必填欄位有 required'], '<form><label for="name">姓名</label><input id="name" required><label for="email">Email</label><input id="email" type="email" required><button>送出</button></form>'],
  [2, 4, '選擇器與特異度', '掌握元素、class、id 與後代選擇器的優先順序。', '誰的顏色會生效？', code('<button id="special" class="button">看看我的顏色</button>', 'button{background:#f3b45d;padding:10px;border:0}.button{background:#5b8def}#special{background:#e76f8f;color:white}', ''), '調整選擇器，讓按鈕套用你指定的顏色。', ['我能分辨元素、class、id 選擇器', '我理解 id 通常比 class 具特異度'], '#special{background:#e76f8f;color:white}'],
  [2, 5, '偽類與偽元素', '用狀態選擇器與生成內容打造細緻互動。', '狀態與裝飾', code('<h2 class="title">互動按鈕</h2><button>移入我</button>', '.title::before{content:"✦";color:#5268e6;margin-right:8px}button{padding:10px}button:hover{background:#5268e6;color:white}', ''), '用 :hover 改變按鈕外觀，並用 ::before 加上裝飾。', ['我使用了 :hover', '我能說明 :before 與 :hover 的差異'], '.title::before{content:"✦";margin-right:8px}button:hover{background:#5268e6;color:white}'],
  [2, 6, '盒模型與 box-sizing', '理解 margin、border、padding 如何影響元素尺寸。', '卡片尺寸', code('<div class="card">盒模型卡片</div>', '.card{width:220px;padding:24px;border:5px solid #5268e6;background:#eef0ff;box-sizing:border-box}', ''), '讓卡片包含 padding 與 border 後，仍維持指定寬度。', ['我有設定 box-sizing', '卡片沒有超出指定尺寸'], '.card{width:220px;padding:24px;border:5px solid #5268e6;box-sizing:border-box}'],
  [2, 7, '文字排版', '用字級、行高與字距改善內容的閱讀體驗。', '舒適的文章', code('<article><h2>一段好讀的文字</h2><p>適當的行高與字距，可以讓讀者更容易閱讀長篇內容。</p></article>', 'article{max-width:330px}p{font-size:16px;line-height:1.9;letter-spacing:.5px}', ''), '調整文章的 line-height 與 letter-spacing，讓它更好讀。', ['段落有適當的 line-height', '標題與內文有清楚層次'], 'p{font-size:16px;line-height:1.9;letter-spacing:.5px}'],
  [2, 8, '色彩與背景', '使用純色、漸層與背景圖片建立視覺氛圍。', '天空漸層', code('<section class="sky"><h2>美好的一天</h2></section>', '.sky{height:130px;padding:20px;color:white;background:linear-gradient(135deg,#5b8def,#f19b9b)}', ''), '使用 linear-gradient 做出天空到日落的漸層。', ['我有使用 background 或 background-color', '漸層至少有兩種顏色'], '.sky{background:linear-gradient(135deg,#5b8def,#f19b9b);color:white}'],
  [3, 9, '圓角 border-radius', '用圓角創造卡片、圓形與膠囊按鈕。', '圓角造型', code('<div class="shapes"><span>卡片</span><span>圓形</span><span>膠囊</span></div>', '.shapes{display:flex;gap:10px}.shapes span{padding:18px;background:#dfe4ff;border-radius:14px}.shapes span:nth-child(2){border-radius:50%}.shapes span:nth-child(3){border-radius:999px}', ''), '調整 border-radius，做出三種不同造型。', ['我能使用不同 border-radius 值', '圓形的寬高相同'], '.shapes span{border-radius:14px}.shapes span:nth-child(2){border-radius:50%}.shapes span:nth-child(3){border-radius:999px}'],
  [3, 10, '陰影 box-shadow / text-shadow', '使用陰影製造浮起、凹陷與立體層次。', '浮起的卡片', code('<div class="card"><strong>設計靈感</strong><p>陰影讓元素有了空間感。</p></div>', '.card{padding:22px;border-radius:14px;background:white;box-shadow:0 12px 25px #23345c22}.card strong{text-shadow:1px 2px 2px #bbc}', ''), '為卡片加上柔和陰影，並讓按鈕有按下去的感覺。', ['我設定了 offset 與 blur', '陰影顏色不會太濃'], '.card{box-shadow:0 12px 25px #23345c22}'],
  [3, 11, '毛玻璃特效 backdrop-filter', '理解半透明背景與 blur 如何產生毛玻璃效果。', '玻璃卡片', code('<div class="scene"><div class="glass"><h2>Glassmorphism</h2><p>透過背景模糊創造層次。</p></div></div>', '.scene{padding:30px;background:linear-gradient(135deg,#5268e6,#e47eaa)}.glass{padding:18px;color:white;background:#ffffff33;backdrop-filter:blur(10px);border:1px solid #ffffff66;border-radius:16px}', ''), '把導覽列做成背景可透出的毛玻璃效果。', ['背景有半透明色', '我有使用 backdrop-filter: blur'], '.glass{background:#ffffff33;backdrop-filter:blur(10px);border:1px solid #ffffff66}'],
  [3, 12, 'transform 變形', '用 translate、rotate、scale 與 origin 製造動態感。', 'Hover 變形卡片', code('<div class="card">移入看看</div>', '.card{padding:35px;background:#eef0ff;border-radius:12px;transition:.3s}.card:hover{transform:rotate(-3deg) scale(1.06)}', ''), '完成一張 hover 時放大並輕微旋轉的卡片。', ['我有使用 transform', '變化有 transition 過渡'], '.card:hover{transform:rotate(-3deg) scale(1.06);transition:.3s}'],
  [4, 13, 'Flexbox 排版', '使用一維排版對齊導覽列與卡片欄位。', '三欄卡片', code('<div class="row"><div>HTML</div><div>CSS</div><div>JS</div></div>', '.row{display:flex;gap:12px;justify-content:center}.row div{flex:1;padding:28px 12px;text-align:center;background:#eef0ff;border-radius:10px}', ''), '使用 Flexbox 做出等分三欄並保持間距。', ['容器有 display:flex', '三個欄位寬度相等'], '.row{display:flex;gap:12px}.row div{flex:1}'],
  [4, 14, 'transition 過渡動畫', '讓 hover 或 class 狀態的變化平滑呈現。', '平滑按鈕', code('<button class="smooth">移入我</button>', '.smooth{padding:12px 20px;border:0;border-radius:8px;background:#dfe4ff;transition:background .3s,transform .3s}.smooth:hover{background:#5268e6;color:white;transform:translateY(-3px)}', ''), '替按鈕和手風琴效果加入 transition。', ['transition 寫在原始狀態', '變化不會瞬間跳動'], '.smooth{transition:background .3s,transform .3s}.smooth:hover{background:#5268e6;transform:translateY(-3px)}'],
  [5, 15, 'DOM 選取與內容操作', '選取元素並用 JavaScript 更新文字與樣式。', '點擊改變文字', code('<p id="message">還沒有按下按鈕</p><button id="change">點我</button>', 'button{padding:8px 13px;border:0;border-radius:6px;background:#5268e6;color:white}', "document.querySelector('#change').addEventListener('click',()=>{document.querySelector('#message').textContent='你成功改變了內容！'})"), '按下按鈕後，將提示文字更新成你的訊息。', ['我有使用 querySelector', '點擊後 textContent 會更新'], "document.querySelector('#change').addEventListener('click',()=>{document.querySelector('#message').textContent='完成！'})"],
  [5, 16, '事件監聽 addEventListener', '掌握 click、input 等事件，讓頁面回應使用者。', '即時輸入預覽', code('<input id="name" placeholder="輸入名字"><p>你好，<span id="output">訪客</span>！</p>', '', "document.querySelector('#name').addEventListener('input',(event)=>{document.querySelector('#output').textContent=event.target.value||'訪客'})"), '做出輸入文字後即時更新畫面的效果。', ['我有監聽 input 事件', '空值時仍有預設文字'], "document.querySelector('#name').addEventListener('input',(event)=>{document.querySelector('#output').textContent=event.target.value||'訪客'})"],
  [5, 17, '動態增刪元素與 classList', '建立元素、加入清單並切換深色模式。', '待辦清單', code('<input id="todo" placeholder="新增待辦"><button id="add">新增</button><ul id="list"></ul>', 'button{margin-left:6px;padding:7px;background:#5268e6;color:white;border:0;border-radius:5px}', "document.querySelector('#add').addEventListener('click',()=>{const input=document.querySelector('#todo');if(input.value){const li=document.createElement('li');li.textContent=input.value;document.querySelector('#list').appendChild(li);input.value='' }})"), '完成可新增項目的待辦清單，並思考如何加入刪除功能。', ['我有使用 createElement 與 appendChild', '新增後輸入框會清空'], "const li=document.createElement('li');li.textContent=input.value;document.querySelector('#list').appendChild(li);"],
]

export const lessons: Lesson[] = topics.map((topic) => {
  const [stage, number, title, objective, exampleTitle, starterCode] = topic
  const checklist = topic[7]
  const formatted = formatCodeSet(starterCode)
  return {
    id: `${stage}-${number}`, number, stage, type: stage === 1 ? 'HTML' : stage <= 4 ? 'CSS' : 'JavaScript', title, objective,
    introduction: introductions[number].text,
    concepts: introductions[number].concepts,
    example: {
      title: exampleTitle,
      description: '先觀察完整範例的結構，再到下方編輯器動手修改。',
      code: [
        formatted.html,
        formatted.css ? `/* CSS 樣式 */\n${formatted.css}` : '',
        formatted.js ? `/* JavaScript 互動 */\n${formatted.js}` : '',
      ].filter(Boolean).join('\n\n'),
      preview: [
        formatted.html,
        formatted.css ? `<style>\n${formatted.css}\n</style>` : '',
        formatted.js ? `<script>\n${formatted.js.replace(/<\//g, '<\\/')}\n<\/script>` : '',
      ].filter(Boolean).join('\n'),
    },
    practice: {
      instructions: challengeInstructions[number],
      starterCode: formatCodeSet(challengeStarters[number]),
      checklist,
      answer: formatCodeSet(challengeAnswers[number]),
    },
  }
})

export const defaultStages: Stage[] = stages
export const defaultLessons: Lesson[] = lessons

