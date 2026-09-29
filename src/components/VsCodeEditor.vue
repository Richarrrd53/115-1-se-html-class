<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'

export interface EditorCode {
  html: string
  css: string
  js: string
}

export interface EditorError {
  panel: 'html' | 'css' | 'js'
  message: string
  line?: number
}

export interface ColorMatch {
  color: string
  line: number
  startCol: number
  rawIndex: number
  hex: string
}

export interface CustomCompletionWord {
  label: string
  detail?: string
  insertText?: string
}

export interface LessonCustomCompletions {
  html?: (string | CustomCompletionWord)[]
  css?: (string | CustomCompletionWord)[]
  js?: (string | CustomCompletionWord)[]
}

const props = withDefaults(
  defineProps<{
    modelValue: EditorCode
    activePanel?: 'html' | 'css' | 'js'
    errors?: EditorError[]
    customCompletions?: LessonCustomCompletions
  }>(),
  {
    activePanel: 'html',
    errors: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: EditorCode): void
  (e: 'update:activePanel', panel: 'html' | 'css' | 'js'): void
  (e: 'resetTab', panel: 'html' | 'css' | 'js'): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const gutterRef = ref<HTMLElement | null>(null)
const backdropRef = ref<HTMLElement | null>(null)
const colorInputRef = ref<HTMLInputElement | null>(null)

const cursorLine = ref(1)
const cursorCol = ref(1)
const selectedCharCount = ref(0)
const isWordWrap = ref(false)
const copySuccessToast = ref(false)
const selectedSuggestionIndex = ref(0)
const suggestionQuery = ref('')

interface CompletionItem {
  label: string
  detail: string
  insertText: string
  isCustom?: boolean
}

// 內建完整程式碼自動補全項目（HTML / CSS / JavaScript）
const builtInCompletions: Record<'html' | 'css' | 'js', CompletionItem[]> = {
  html: [
    // 結構與排版
    { label: '<header>', detail: '頁首區塊標籤', insertText: '<header></header>' },
    { label: '<nav>', detail: '導覽列區塊標籤', insertText: '<nav></nav>' },
    { label: '<main>', detail: '主要內容區塊標籤', insertText: '<main></main>' },
    { label: '<section>', detail: '內容章節段落區塊', insertText: '<section></section>' },
    { label: '<article>', detail: '獨立文章區塊標籤', insertText: '<article></article>' },
    { label: '<aside>', detail: '側邊欄或補充區塊', insertText: '<aside></aside>' },
    { label: '<footer>', detail: '頁尾區塊標籤', insertText: '<footer></footer>' },
    { label: '<div>', detail: '通用容器元素', insertText: '<div></div>' },
    { label: '<p>', detail: '段落文字元素', insertText: '<p></p>' },
    { label: '<span>', detail: '行內文字元素', insertText: '<span></span>' },
    { label: '<h1>', detail: '第一層大標題', insertText: '<h1></h1>' },
    { label: '<h2>', detail: '第二層標題', insertText: '<h2></h2>' },
    { label: '<h3>', detail: '第三層標題', insertText: '<h3></h3>' },
    { label: '<strong>', detail: '粗體強調元素', insertText: '<strong></strong>' },
    { label: '<em>', detail: '斜體強調元素', insertText: '<em></em>' },
    { label: '<a href="">', detail: '超連結元素', insertText: '<a href=""></a>' },
    { label: '<img src="" alt="">', detail: '影像圖片元素', insertText: '<img src="" alt="">' },
    // 清單與表格
    { label: '<ul>', detail: '無序清單容器', insertText: '<ul>\n  <li></li>\n</ul>' },
    { label: '<ol>', detail: '有序清單容器', insertText: '<ol>\n  <li></li>\n</ol>' },
    { label: '<li>', detail: '清單項目', insertText: '<li></li>' },
    { label: '<table>', detail: '表格容器', insertText: '<table>\n  <tr><th></th></tr>\n  <tr><td></td></tr>\n</table>' },
    { label: '<caption>', detail: '表格標題', insertText: '<caption></caption>' },
    { label: '<tr>', detail: '表格列 (橫排)', insertText: '<tr></tr>' },
    { label: '<th>', detail: '表頭欄位儲存格', insertText: '<th></th>' },
    { label: '<td>', detail: '資料儲存格', insertText: '<td></td>' },
    // 表單
    { label: '<form>', detail: '表單容器', insertText: '<form>\n  \n</form>' },
    { label: '<label>', detail: '欄位標籤', insertText: '<label for=""></label>' },
    { label: '<input>', detail: '單行輸入框', insertText: '<input type="text">' },
    { label: '<button>', detail: '按鈕元素', insertText: '<button></button>' },
    { label: '<textarea>', detail: '多行文字輸入框', insertText: '<textarea></textarea>' },
    { label: '<select>', detail: '下拉選單元素', insertText: '<select>\n  <option value=""></option>\n</select>' },
    { label: '<option>', detail: '選單項目', insertText: '<option value=""></option>' },
    // HTML 屬性
    { label: 'class=""', detail: 'Class 樣式類別', insertText: 'class=""' },
    { label: 'id=""', detail: '唯一 ID 識別名稱', insertText: 'id=""' },
    { label: 'placeholder=""', detail: '輸入框預設提示', insertText: 'placeholder=""' },
    { label: 'type="text"', detail: '文字輸入類型', insertText: 'type="text"' },
    { label: 'type="password"', detail: '密碼輸入類型', insertText: 'type="password"' },
    { label: 'type="email"', detail: '信箱輸入類型', insertText: 'type="email"' },
    { label: 'type="number"', detail: '數字輸入類型', insertText: 'type="number"' },
    { label: 'type="submit"', detail: '送出按鈕類型', insertText: 'type="submit"' },
    { label: 'required', detail: '必填欄位屬性', insertText: 'required' },
    { label: 'disabled', detail: '禁用控制項屬性', insertText: 'disabled' },
    { label: 'style=""', detail: '行內樣式屬性', insertText: 'style=""' },
    { label: 'aria-label=""', detail: '無障礙輔助標籤', insertText: 'aria-label=""' },
  ],
  css: [
    // 盒模型與排版
    { label: 'display: flex', detail: '啟動 Flexbox 排版', insertText: 'display: flex;' },
    { label: 'display: grid', detail: '啟動 Grid 網格排版', insertText: 'display: grid;' },
    { label: 'display: block', detail: '區塊元素排列', insertText: 'display: block;' },
    { label: 'display: inline-block', detail: '行內區塊排列', insertText: 'display: inline-block;' },
    { label: 'display: none', detail: '隱藏元素', insertText: 'display: none;' },
    { label: 'flex-direction', detail: 'Flex 主軸方向', insertText: 'flex-direction: ' },
    { label: 'justify-content', detail: '主軸對齊方式', insertText: 'justify-content: ' },
    { label: 'align-items', detail: '交叉軸對齊方式', insertText: 'align-items: ' },
    { label: 'flex-wrap', detail: 'Flex 自動換行', insertText: 'flex-wrap: wrap;' },
    { label: 'flex: 1', detail: '彈性比例均分', insertText: 'flex: 1;' },
    { label: 'gap', detail: '排版間距', insertText: 'gap: ' },
    { label: 'box-sizing: border-box', detail: '尺寸包含內距邊框', insertText: 'box-sizing: border-box;' },
    { label: 'box-sizing: content-box', detail: '標準內容盒模型', insertText: 'box-sizing: content-box;' },
    { label: 'width', detail: '寬度', insertText: 'width: ' },
    { label: 'height', detail: '高度', insertText: 'height: ' },
    { label: 'max-width', detail: '最大寬度', insertText: 'max-width: ' },
    { label: 'min-width', detail: '最小寬度', insertText: 'min-width: ' },
    { label: 'margin', detail: '外距', insertText: 'margin: ' },
    { label: 'margin: 0 auto', detail: '區塊水平居中', insertText: 'margin: 0 auto;' },
    { label: 'padding', detail: '內距', insertText: 'padding: ' },
    // 色彩、背景與邊框
    { label: 'color', detail: '文字顏色', insertText: 'color: ' },
    { label: 'background', detail: '背景屬性', insertText: 'background: ' },
    { label: 'background-color', detail: '背景顏色', insertText: 'background-color: ' },
    { label: 'background-image', detail: '背景圖片', insertText: 'background-image: ' },
    { label: 'linear-gradient', detail: '線性漸層色', insertText: 'linear-gradient(135deg, , )' },
    { label: 'border', detail: '邊框設定', insertText: 'border: 1px solid ;' },
    { label: 'border-radius', detail: '圓角半徑', insertText: 'border-radius: ' },
    { label: 'border-radius: 50%', detail: '正圓形造型', insertText: 'border-radius: 50%;' },
    { label: 'border-radius: 999px', detail: '膠囊圓角按鈕', insertText: 'border-radius: 999px;' },
    { label: 'box-shadow', detail: '盒子立體陰影', insertText: 'box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);' },
    { label: 'text-shadow', detail: '文字立體陰影', insertText: 'text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);' },
    { label: 'backdrop-filter: blur()', detail: '毛玻璃背景模糊濾鏡', insertText: 'backdrop-filter: blur(10px);' },
    // 字型排版
    { label: 'font-size', detail: '字體大小', insertText: 'font-size: ' },
    { label: 'font-weight', detail: '字體粗細', insertText: 'font-weight: ' },
    { label: 'line-height', detail: '行距高度', insertText: 'line-height: ' },
    { label: 'letter-spacing', detail: '字元間隔', insertText: 'letter-spacing: ' },
    { label: 'text-align', detail: '文字對齊方向', insertText: 'text-align: ' },
    { label: 'text-decoration', detail: '文字裝飾底線', insertText: 'text-decoration: none;' },
    // 定位與動態
    { label: 'position: relative', detail: '相對定位', insertText: 'position: relative;' },
    { label: 'position: absolute', detail: '絕對定位', insertText: 'position: absolute;' },
    { label: 'transform', detail: '2D/3D 空間變形', insertText: 'transform: ' },
    { label: 'transform-origin', detail: '變形基準錨點', insertText: 'transform-origin: ' },
    { label: 'transition', detail: '平滑狀態過渡動畫', insertText: 'transition: all 0.3s ease;' },
    { label: 'cursor: pointer', detail: '懸停手型游標', insertText: 'cursor: pointer;' },
    { label: 'overflow: hidden', detail: '溢出內容隱藏', insertText: 'overflow: hidden;' },
    { label: 'opacity', detail: '透明度', insertText: 'opacity: ' },
    // 偽類與偽元素
    { label: ':hover', detail: '滑鼠懸停狀態偽類', insertText: ':hover {\n  \n}' },
    { label: ':active', detail: '滑鼠點擊按壓狀態', insertText: ':active {\n  \n}' },
    { label: ':focus', detail: '輸入焦點聚焦狀態', insertText: ':focus {\n  \n}' },
    { label: ':nth-child()', detail: '指定序號子元素偽類', insertText: ':nth-child(even)' },
    { label: '::before', detail: '元素內容前置偽元素', insertText: '::before {\n  content: "";\n}' },
    { label: '::after', detail: '元素內容後置偽元素', insertText: '::after {\n  content: "";\n}' },
  ],
  js: [
    // 變數與關鍵字
    { label: 'const', detail: '宣告常數', insertText: 'const ' },
    { label: 'let', detail: '宣告變數', insertText: 'let ' },
    { label: 'function', detail: '定義具名函式', insertText: 'function name() {\n  \n}' },
    { label: 'return', detail: '函式回傳值', insertText: 'return ' },
    { label: 'console.log', detail: '印出除錯訊息', insertText: 'console.log()' },
    { label: 'if', detail: '條件判斷式', insertText: 'if () {\n  \n}' },
    { label: 'if / else', detail: '條件分支判斷', insertText: 'if () {\n  \n} else {\n  \n}' },
    { label: 'for', detail: '計數迴圈', insertText: 'for (let i = 0; i < length; i++) {\n  \n}' },
    // DOM 選取
    { label: 'document.querySelector', detail: '選取首個匹配的 DOM 元素', insertText: "document.querySelector('')" },
    { label: 'document.querySelectorAll', detail: '選取全部符合的 DOM 元素', insertText: "document.querySelectorAll('')" },
    { label: 'document.getElementById', detail: '依照 ID 選取元素', insertText: "document.getElementById('')" },
    { label: 'document.createElement', detail: '動態建立新的 HTML 元素', insertText: "document.createElement('')" },
    // 事件處理
    { label: 'addEventListener', detail: '監聽使用者操作事件', insertText: "addEventListener('click', (event) => {\n  \n})" },
    { label: "'click'", detail: '點擊事件名稱', insertText: "'click'" },
    { label: "'input'", detail: '即時輸入變更事件', insertText: "'input'" },
    { label: "'change'", detail: '值確認變更事件', insertText: "'change'" },
    { label: 'event.target', detail: '事件觸發目標節點', insertText: 'event.target' },
    { label: 'event.preventDefault()', detail: '阻止瀏覽器預設行為', insertText: 'event.preventDefault()' },
    // DOM 操作與屬性
    { label: 'textContent', detail: '讀取或修改元素純文字內容', insertText: 'textContent' },
    { label: 'innerHTML', detail: '讀取或修改元素 HTML 結構', insertText: 'innerHTML' },
    { label: 'value', detail: '輸入框欄位當前數值', insertText: 'value' },
    { label: 'appendChild', detail: '將節點加入至子元素末尾', insertText: 'appendChild()' },
    { label: 'append', detail: '插入多個節點或文字字串', insertText: 'append()' },
    { label: 'remove', detail: '從 DOM 樹中刪除該節點', insertText: 'remove()' },
    { label: 'setAttribute', detail: '設定元素指定 HTML 屬性', insertText: "setAttribute('', '')" },
    { label: 'getAttribute', detail: '取得元素指定 HTML 屬性值', insertText: "getAttribute('')" },
    { label: 'classList.add', detail: '新增 CSS 樣式類別', insertText: "classList.add('')" },
    { label: 'classList.remove', detail: '移除 CSS 樣式類別', insertText: "classList.remove('')" },
    { label: 'classList.toggle', detail: '切換 CSS 樣式類別狀態', insertText: "classList.toggle('')" },
    { label: 'classList.contains', detail: '檢查是否含有特定 class', insertText: "classList.contains('')" },
    { label: 'style', detail: '直接存取或修改行內樣式', insertText: 'style.' },
    // 常用工具
    { label: 'Math.max', detail: '取得陣列或數值最大值', insertText: 'Math.max()' },
    { label: 'Math.min', detail: '取得陣列或數值最小值', insertText: 'Math.min()' },
    { label: 'Math.round', detail: '四捨五入計算', insertText: 'Math.round()' },
    { label: 'parseInt', detail: '將字串轉為整數數值', insertText: 'parseInt()' },
    { label: 'setTimeout', detail: '非同步延遲計時器', insertText: 'setTimeout(() => {\n  \n}, 1000)' },
    { label: 'JSON.stringify', detail: '將物件轉為 JSON 字串', insertText: 'JSON.stringify()' },
    { label: 'JSON.parse', detail: '將 JSON 字串解析為物件', insertText: 'JSON.parse()' },
  ],
}

// 合併題目專屬自訂詞語與內建完整補全庫，題目自訂詞語優先排序置頂
const activePanelCompletions = computed<CompletionItem[]>(() => {
  const panel = props.activePanel
  const customList = props.customCompletions?.[panel] || []

  const formattedCustom: CompletionItem[] = []
  for (const c of customList) {
    if (!c) continue
    if (typeof c === 'string') {
      const trimmed = c.trim()
      if (!trimmed) continue
      let insert = trimmed
      if (
        panel === 'html' &&
        trimmed.startsWith('<') &&
        !trimmed.startsWith('</') &&
        !trimmed.endsWith('/>') &&
        trimmed.endsWith('>')
      ) {
        const tagName = trimmed.slice(1, -1).split(' ')[0]
        insert = `<${tagName}></${tagName}>`
      } else if (
        panel === 'css' &&
        !trimmed.includes(':') &&
        !trimmed.startsWith('@') &&
        !trimmed.startsWith(':') &&
        !trimmed.startsWith('.') &&
        !trimmed.startsWith('#')
      ) {
        insert = `${trimmed}: `
      }
      formattedCustom.push({
        label: trimmed,
        detail: '題目指定詞語',
        insertText: insert,
        isCustom: true,
      })
    } else if (typeof c === 'object' && c.label) {
      const label = c.label.trim()
      if (!label) continue
      let insert = c.insertText?.trim() || label
      if (
        !c.insertText &&
        panel === 'html' &&
        label.startsWith('<') &&
        !label.startsWith('</') &&
        !label.endsWith('/>') &&
        label.endsWith('>')
      ) {
        const tagName = label.slice(1, -1).split(' ')[0]
        insert = `<${tagName}></${tagName}>`
      }
      formattedCustom.push({
        label,
        detail: c.detail || '題目指定詞語',
        insertText: insert,
        isCustom: true,
      })
    }
  }

  // 避免標籤完全重複
  const seenLabels = new Set(formattedCustom.map((item) => item.label.toLowerCase()))
  const remainingBuiltIn = (builtInCompletions[panel] || []).filter(
    (item) => !seenLabels.has(item.label.toLowerCase()),
  )

  return [...formattedCustom, ...remainingBuiltIn]
})

// 供快捷列展示的當前語言題目專屬推薦詞語
const currentCustomWords = computed(() => {
  const panel = props.activePanel
  const customList = props.customCompletions?.[panel] || []
  return customList
    .map((c) => {
      if (typeof c === 'string') {
        const label = c.trim()
        let insert = label
        if (
          panel === 'html' &&
          label.startsWith('<') &&
          !label.startsWith('</') &&
          !label.endsWith('/>') &&
          label.endsWith('>')
        ) {
          const tagName = label.slice(1, -1).split(' ')[0]
          insert = `<${tagName}></${tagName}>`
        }
        return { label, detail: '', insertText: insert }
      }
      let insert = c.insertText?.trim() || c.label
      if (
        !c.insertText &&
        panel === 'html' &&
        c.label.startsWith('<') &&
        !c.label.startsWith('</') &&
        !c.label.endsWith('/>') &&
        c.label.endsWith('>')
      ) {
        const tagName = c.label.slice(1, -1).split(' ')[0]
        insert = `<${tagName}></${tagName}>`
      }
      return {
        label: c.label,
        detail: c.detail || '',
        insertText: insert,
      }
    })
    .filter((w) => Boolean(w.label))
})

function insertCustomWord(word: { label: string; insertText?: string }) {
  const textarea = textareaRef.value
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const insert = word.insertText || word.label
  currentCode.value =
    textarea.value.substring(0, start) + insert + textarea.value.substring(end)
  nextTick(() => {
    let nextCursor = start + insert.length
    const emptyQuotesIdx = insert.indexOf("''")
    const emptyDoubleQuotesIdx = insert.indexOf('""')
    const emptyParensIdx = insert.indexOf('()')
    const emptyTagsMatch = insert.match(/<([a-zA-Z0-9]+)[^>]*><\/\1>/)

    if (emptyTagsMatch && emptyTagsMatch.index !== undefined) {
      const openTagLen = emptyTagsMatch[0].indexOf('>') + 1
      nextCursor = start + emptyTagsMatch.index + openTagLen
    } else if (emptyDoubleQuotesIdx !== -1) {
      nextCursor = start + emptyDoubleQuotesIdx + 1
    } else if (emptyQuotesIdx !== -1) {
      nextCursor = start + emptyQuotesIdx + 1
    } else if (emptyParensIdx !== -1) {
      nextCursor = start + emptyParensIdx + 1
    }

    textarea.setSelectionRange(nextCursor, nextCursor)
    textarea.focus()
    updateCursorInfo()
  })
}

// 目前選取要更換顏色的目標
const activeColorTarget = ref<{
  color: string
  rawIndex: number
  length: number
} | null>(null)

const currentCode = computed({
  get() {
    return props.modelValue[props.activePanel] || ''
  },
  set(val: string) {
    emit('update:modelValue', {
      ...props.modelValue,
      [props.activePanel]: val,
    })
  },
})

// 分割所有行
const lines = computed(() => currentCode.value.split('\n'))
const totalLinesCount = computed(() => lines.value.length)

// 顏色代碼正則：支援 3/4/6/8 位 Hex, 以及 rgb/rgba, hsl/hsla
const COLOR_REGEX = /(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+%?)?\s*\)|hsla?\(\s*[\d.]+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+%?)?\s*\))/gi

function cssColorToHex(colorStr: string): string {
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return '#000000'
    ctx.fillStyle = colorStr
    const computed = ctx.fillStyle
    if (computed.startsWith('#')) {
      if (computed.length === 4) {
        return `#${computed[1]}${computed[1]}${computed[2]}${computed[2]}${computed[3]}${computed[3]}`
      }
      return computed.substring(0, 7)
    }
    const match = computed.match(/\d+/g)
    if (match && match.length >= 3) {
      const r = Number(match[0]).toString(16).padStart(2, '0')
      const g = Number(match[1]).toString(16).padStart(2, '0')
      const b = Number(match[2]).toString(16).padStart(2, '0')
      return `#${r}${g}${b}`
    }
  } catch {}
  return '#000000'
}

// 分析當前檔案中所有出現的顏色代碼
const detectedColors = computed<ColorMatch[]>(() => {
  const result: ColorMatch[] = []
  const text = currentCode.value
  let match: RegExpExecArray | null
  COLOR_REGEX.lastIndex = 0

  while ((match = COLOR_REGEX.exec(text)) !== null) {
    const rawColor = match[0]
    const rawIndex = match.index
    const textBefore = text.substring(0, rawIndex)
    const lineNum = textBefore.split('\n').length
    const lastNewline = textBefore.lastIndexOf('\n')
    const startCol = lastNewline === -1 ? rawIndex + 1 : rawIndex - lastNewline

    result.push({
      color: rawColor,
      line: lineNum,
      startCol,
      rawIndex,
      hex: cssColorToHex(rawColor),
    })
  }

  return result
})

// 依行號聚合顏色（供 Line Numbers Gutter 顯示）
const lineColorsMap = computed(() => {
  const map: Record<number, ColorMatch[]> = {}
  for (const item of detectedColors.value) {
    if (!map[item.line]) map[item.line] = []
    map[item.line].push(item)
  }
  return map
})

export interface LineToken {
  text: string
  isColor: boolean
  color?: string
  match?: ColorMatch
}

export interface OverlayLine {
  lineNum: number
  tokens: LineToken[]
}

// 計算每行起始字元 index，讓每行行內色塊能精確原地修改
const lineStartIndices = computed(() => {
  const text = currentCode.value
  const indices = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      indices.push(i + 1)
    }
  }
  return indices
})

// 分析行內各 token，在顏色代碼前加上方形即時預覽方塊
const overlayLines = computed<OverlayLine[]>(() => {
  const rawLines = lines.value
  const starts = lineStartIndices.value

  return rawLines.map((lineText, idx) => {
    const lineNum = idx + 1
    const lineStartPos = starts[idx] ?? 0

    if (!lineText) {
      return { lineNum, tokens: [{ text: '', isColor: false }] }
    }

    const tokens: LineToken[] = []
    let lastIdx = 0
    let m: RegExpExecArray | null
    const reg = new RegExp(COLOR_REGEX.source, 'gi')

    while ((m = reg.exec(lineText)) !== null) {
      const matchText = m[0]
      const matchStart = m.index

      if (matchStart > lastIdx) {
        tokens.push({
          text: lineText.substring(lastIdx, matchStart),
          isColor: false,
        })
      }

      tokens.push({
        text: matchText,
        isColor: true,
        color: matchText,
        match: {
          color: matchText,
          line: lineNum,
          startCol: matchStart + 1,
          rawIndex: lineStartPos + matchStart,
          hex: cssColorToHex(matchText),
        },
      })

      lastIdx = matchStart + matchText.length
    }

    if (lastIdx < lineText.length) {
      tokens.push({
        text: lineText.substring(lastIdx),
        isColor: false,
      })
    }

    return { lineNum, tokens }
  })
})

// 獨特顏色清單（供頂部/底部色彩快捷列點擊挑色）
const uniqueColors = computed(() => {
  const seen = new Set<string>()
  const list: ColorMatch[] = []
  for (const c of detectedColors.value) {
    const norm = c.color.toLowerCase()
    if (!seen.has(norm)) {
      seen.add(norm)
      list.push(c)
    }
  }
  return list
})

// 當前 Panel 錯誤行號集合
const errorLines = computed(() => {
  const set = new Set<number>()
  for (const err of props.errors) {
    if (err.panel === props.activePanel && err.line) {
      set.add(err.line)
    }
  }
  return set
})

// 面板錯誤標記
function hasPanelError(panel: 'html' | 'css' | 'js'): boolean {
  return props.errors.some((e) => e.panel === panel)
}

function selectPanel(panel: 'html' | 'css' | 'js') {
  emit('update:activePanel', panel)
  nextTick(() => {
    updateCursorInfo()
    syncScroll()
  })
}

// 滾動同步
function syncScroll() {
  if (!textareaRef.value) return
  const { scrollTop, scrollLeft } = textareaRef.value
  if (gutterRef.value) {
    gutterRef.value.scrollTop = scrollTop
  }
  if (backdropRef.value) {
    backdropRef.value.scrollTop = scrollTop
    backdropRef.value.scrollLeft = scrollLeft
  }
}

// 游標位置與選取字數追蹤
function updateCursorInfo() {
  if (!textareaRef.value) return
  const start = textareaRef.value.selectionStart
  const end = textareaRef.value.selectionEnd
  selectedCharCount.value = Math.abs(end - start)

  const textBefore = textareaRef.value.value.substring(0, start)
  const splitted = textBefore.split('\n')
  cursorLine.value = splitted.length
  cursorCol.value = splitted[splitted.length - 1].length + 1
  updateSuggestions()
}

// 補全選單的動態游標定位計算
const menuTop = computed(() => {
  const lineTop = 12 + cursorLine.value * 24 - (textareaRef.value?.scrollTop || 0)
  const containerHeight = textareaRef.value?.clientHeight || 400
  if (lineTop > containerHeight - 190) {
    return `${Math.max(10, lineTop - 24 - 190)}px`
  }
  return `${lineTop}px`
})

const menuLeft = computed(() => {
  const colLeft = 14 + (cursorCol.value - 1) * 8.4 - (textareaRef.value?.scrollLeft || 0)
  return `${Math.max(14, Math.min(colLeft, 340))}px`
})

function getCompletionContext() {
  const textarea = textareaRef.value
  if (!textarea) return null

  const start = textarea.selectionStart
  const beforeCursor = textarea.value.substring(0, start)

  // 支援 HTML 標籤/屬性、CSS 屬性/選擇器/偽類、JS 物件鏈與標識符
  const match = beforeCursor.match(/(?:<\/?[a-zA-Z0-9_-]*|::?[a-zA-Z0-9_-]*|@[a-zA-Z0-9_-]*|[a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]*)*|[.#][a-zA-Z0-9_-]*)$/)
  if (!match) return null

  const query = match[0]
  if (!query || query.length < 1) return null

  const qLower = query.toLowerCase()
  const qClean = qLower.replace(/^[<:.#@]+/, '')

  const currentItems = activePanelCompletions.value
  const scored = currentItems
    .map((item) => {
      const labelLower = item.label.toLowerCase()
      const labelClean = labelLower.replace(/^[<:.#@]+/, '')
      let score = 0

      // 題目自訂詞語優先排序加權
      if (item.isCustom) score += 100

      if (labelLower === qLower) {
        score += 120
      } else if (labelLower.startsWith(qLower)) {
        score += 90
      } else if (qClean && labelClean.startsWith(qClean)) {
        score += 70
      } else if (labelLower.includes(qLower)) {
        score += 40
      } else if (qClean && labelClean.includes(qClean)) {
        score += 30
      }

      return { item, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)

  if (!scored.length) return null

  return { query, start: start - query.length, options: scored }
}

function updateSuggestions() {
  const context = getCompletionContext()
  suggestionQuery.value = context?.query || ''
  if (!context) {
    selectedSuggestionIndex.value = 0
    return
  }
  selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value, context.options.length - 1)
}

function closeSuggestions() {
  suggestionQuery.value = ''
  selectedSuggestionIndex.value = 0
}

function applySuggestion(item?: CompletionItem) {
  const textarea = textareaRef.value
  const context = getCompletionContext()
  if (!textarea || !context) return false

  const suggestion = item || context.options[selectedSuggestionIndex.value]
  if (!suggestion) return false
  const cursor = textarea.selectionStart
  const insert = suggestion.insertText || suggestion.label

  currentCode.value =
    textarea.value.substring(0, context.start) +
    insert +
    textarea.value.substring(cursor)

  closeSuggestions()
  nextTick(() => {
    // 智慧游標跳轉至標籤或括號內
    let nextCursor = context.start + insert.length
    const emptyQuotesIdx = insert.indexOf("''")
    const emptyDoubleQuotesIdx = insert.indexOf('""')
    const emptyParensIdx = insert.indexOf('()')
    const emptyTagsMatch = insert.match(/<([a-zA-Z0-9]+)[^>]*><\/\1>/)

    if (emptyTagsMatch && emptyTagsMatch.index !== undefined) {
      const openTagLen = emptyTagsMatch[0].indexOf('>') + 1
      nextCursor = context.start + emptyTagsMatch.index + openTagLen
    } else if (emptyDoubleQuotesIdx !== -1) {
      nextCursor = context.start + emptyDoubleQuotesIdx + 1
    } else if (emptyQuotesIdx !== -1) {
      nextCursor = context.start + emptyQuotesIdx + 1
    } else if (emptyParensIdx !== -1) {
      nextCursor = context.start + emptyParensIdx + 1
    }

    textarea.setSelectionRange(nextCursor, nextCursor)
    textarea.focus()
    updateCursorInfo()
  })
  return true
}

function handleSuggestionMouseDown(item: CompletionItem, e: MouseEvent) {
  e.preventDefault()
  applySuggestion(item)
}

// 點擊顏色圖標開啟原生調色盤
function openColorPicker(target: ColorMatch) {
  activeColorTarget.value = {
    color: target.color,
    rawIndex: target.rawIndex,
    length: target.color.length,
  }
  if (colorInputRef.value) {
    colorInputRef.value.value = target.hex
    colorInputRef.value.click()
  }
}

// 調色盤選擇完成後取代對應代碼
function onColorSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input || !activeColorTarget.value) return
  const newHex = input.value
  const target = activeColorTarget.value

  const text = currentCode.value
  // 檢查該位置是否依然是原本的顏色代碼
  const slice = text.substring(target.rawIndex, target.rawIndex + target.length)
  if (slice === target.color) {
    currentCode.value =
      text.substring(0, target.rawIndex) +
      newHex +
      text.substring(target.rawIndex + target.length)
  } else {
    // 若文字變更過，以全域取代第一個匹配項目
    currentCode.value = text.replace(target.color, newHex)
  }
  activeColorTarget.value = null
}

// 鍵盤操作（Tab 縮排、Shift+Tab 反縮排、Enter 自動縮排、括號自動配對）
function handleKeydown(e: KeyboardEvent) {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value

  // Ctrl + Space 或 Cmd + Space 手動喚醒代碼補全
  if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
    e.preventDefault()
    updateSuggestions()
    return
  }

  if (e.key === 'Escape') {
    closeSuggestions()
    return
  }

  const completionContext = getCompletionContext()
  if (completionContext && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault()
    const direction = e.key === 'ArrowDown' ? 1 : -1
    selectedSuggestionIndex.value =
      (selectedSuggestionIndex.value + direction + completionContext.options.length) % completionContext.options.length
    return
  }

  if (completionContext && (e.key === 'Tab' || e.key === 'Enter')) {
    e.preventDefault()
    applySuggestion()
    return
  }

  // 1. Tab & Shift+Tab
  if (e.key === 'Tab') {
    e.preventDefault()
    const indentStr = '  ' // 2 spaces

    if (e.shiftKey) {
      // Shift+Tab: 反縮排
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const lineEnd = value.indexOf('\n', end)
      const actualEnd = lineEnd === -1 ? value.length : lineEnd
      const selectedText = value.substring(lineStart, actualEnd)
      const linesArr = selectedText.split('\n')
      let removedTotal = 0
      let firstLineRemoved = 0

      const unindentedLines = linesArr.map((line, idx) => {
        let removed = 0
        if (line.startsWith('  ')) {
          removed = 2
        } else if (line.startsWith(' ') || line.startsWith('\t')) {
          removed = 1
        }
        removedTotal += removed
        if (idx === 0) firstLineRemoved = removed
        return line.substring(removed)
      })

      const newContent =
        value.substring(0, lineStart) +
        unindentedLines.join('\n') +
        value.substring(actualEnd)

      currentCode.value = newContent
      nextTick(() => {
        textarea.setSelectionRange(
          Math.max(lineStart, start - firstLineRemoved),
          Math.max(lineStart, end - removedTotal),
        )
        updateCursorInfo()
      })
    } else {
      // Tab: 縮排
      if (start !== end && value.substring(start, end).includes('\n')) {
        // 多行選取縮排
        const lineStart = value.lastIndexOf('\n', start - 1) + 1
        const lineEnd = value.indexOf('\n', end)
        const actualEnd = lineEnd === -1 ? value.length : lineEnd
        const selectedText = value.substring(lineStart, actualEnd)
        const linesArr = selectedText.split('\n')
        const indentedLines = linesArr.map((line) => indentStr + line)
        const addedTotal = indentStr.length * linesArr.length

        const newContent =
          value.substring(0, lineStart) +
          indentedLines.join('\n') +
          value.substring(actualEnd)

        currentCode.value = newContent
        nextTick(() => {
          textarea.setSelectionRange(start + indentStr.length, end + addedTotal)
          updateCursorInfo()
        })
      } else {
        // 單游標插入 2 空格
        const newContent = value.substring(0, start) + indentStr + value.substring(end)
        currentCode.value = newContent
        nextTick(() => {
          textarea.setSelectionRange(start + indentStr.length, start + indentStr.length)
          updateCursorInfo()
        })
      }
    }
    return
  }

  // 2. Enter: 延續上一行縮排深度
  if (e.key === 'Enter') {
    e.preventDefault()
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const currentLine = value.substring(lineStart, start)
    const matchIndent = currentLine.match(/^[ \t]*/)
    const indent = matchIndent ? matchIndent[0] : ''

    const lastChar = currentLine.trim().slice(-1)
    const nextChar = value.charAt(start)
    const isBlockOpen =
      lastChar === '{' || lastChar === '(' || (lastChar === '>' && !currentLine.includes('</'))

    let insertText = '\n' + indent
    let cursorOffset = insertText.length

    if (isBlockOpen) {
      if ((lastChar === '{' && nextChar === '}') || (lastChar === '(' && nextChar === ')')) {
        insertText = '\n' + indent + '  \n' + indent
        cursorOffset = 1 + indent.length + 2
      } else {
        insertText = '\n' + indent + '  '
        cursorOffset = insertText.length
      }
    }

    const newContent = value.substring(0, start) + insertText + value.substring(end)
    currentCode.value = newContent
    nextTick(() => {
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset)
      updateCursorInfo()
    })
    return
  }

  // 3. 括號與引號自動閉合
  const pairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
    '`': '`',
  }

  if (pairs[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
    // 若已有選取文字，以括號包圍
    if (start !== end) {
      e.preventDefault()
      const selected = value.substring(start, end)
      const newContent =
        value.substring(0, start) + e.key + selected + pairs[e.key] + value.substring(end)
      currentCode.value = newContent
      nextTick(() => {
        textarea.setSelectionRange(start + 1, end + 1)
        updateCursorInfo()
      })
      return
    }

    // 若下一個字元剛好是將要輸入的閉合括號，直接右移游標
    if ([')', ']', '}', '"', "'", '`'].includes(e.key) && value.charAt(start) === e.key) {
      e.preventDefault()
      textarea.setSelectionRange(start + 1, start + 1)
      updateCursorInfo()
      return
    }

    // 自動閉合
    e.preventDefault()
    const close = pairs[e.key]
    const newContent = value.substring(0, start) + e.key + close + value.substring(end)
    currentCode.value = newContent
    nextTick(() => {
      textarea.setSelectionRange(start + 1, start + 1)
      updateCursorInfo()
    })
    return
  }

  // 4. 退格鍵 (Backspace) 智慧刪除成對括號
  if (e.key === 'Backspace' && start === end && start > 0) {
    const prev = value.charAt(start - 1)
    const next = value.charAt(start)
    if (
      (prev === '(' && next === ')') ||
      (prev === '[' && next === ']') ||
      (prev === '{' && next === '}') ||
      (prev === '"' && next === '"') ||
      (prev === "'" && next === "'") ||
      (prev === '`' && next === '`')
    ) {
      e.preventDefault()
      const newContent = value.substring(0, start - 1) + value.substring(start + 1)
      currentCode.value = newContent
      nextTick(() => {
        textarea.setSelectionRange(start - 1, start - 1)
        updateCursorInfo()
      })
      return
    }
  }
}

// 格式化代碼（基本自動縮排美化）
function formatCurrentCode() {
  const code = currentCode.value
  if (!code.trim()) return

  const linesArr = code.split('\n')
  let depth = 0
  const indentUnit = '  '
  const formatted: string[] = []

  for (const rawLine of linesArr) {
    const trimmed = rawLine.trim()
    if (!trimmed) {
      formatted.push('')
      continue
    }

    // 若此行含有關閉標籤或大括號，先減少縮排
    const closesBracket = trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')
    const closesTag = trimmed.startsWith('</')
    if ((closesBracket || closesTag) && depth > 0) {
      depth--
    }

    formatted.push(indentUnit.repeat(depth) + trimmed)

    // 計算下一行是否應增加深度
    const opensBracket = trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')
    // HTML 簡單未閉合標籤判斷 (非自閉合且非已在同一行閉合)
    const opensTag =
      trimmed.startsWith('<') &&
      !trimmed.startsWith('</') &&
      !trimmed.endsWith('/>') &&
      trimmed.endsWith('>') &&
      !trimmed.includes('</')

    if (opensBracket || opensTag) {
      depth++
    }
  }

  currentCode.value = formatted.join('\n')
}

// 複製目前分頁代碼
function copyCurrentCode() {
  navigator.clipboard.writeText(currentCode.value).then(() => {
    copySuccessToast.value = true
    setTimeout(() => {
      copySuccessToast.value = false
    }, 2000)
  })
}

// 監聽面板切換時同步游標
watch(
  () => props.activePanel,
  () => {
    nextTick(() => {
      updateCursorInfo()
      syncScroll()
    })
  },
)

onMounted(() => {
  nextTick(() => {
    updateCursorInfo()
    syncScroll()
  })
})
</script>

<template>
  <div class="vsc-editor-root">
    <!-- 隱藏的顏色選擇器 input -->
    <input
      ref="colorInputRef"
      type="color"
      class="vsc-hidden-color-input"
      @change="onColorSelected"
    />

    <!-- VS Code 頂部分頁導覽列 -->
    <div class="vsc-header-bar">
      <div class="vsc-tabs-list">
        <button
          type="button"
          class="vsc-tab-btn"
          :class="{ active: activePanel === 'html', 'has-error': hasPanelError('html') }"
          @click="selectPanel('html')"
          title="HTML 樣板檔案"
        >
          <span class="file-icon icon-html">&lt;&gt;</span>
          <span class="file-name">index.html</span>
          <span v-if="hasPanelError('html')" class="vsc-error-badge" title="有未通過項目">!</span>
        </button>

        <button
          type="button"
          class="vsc-tab-btn"
          :class="{ active: activePanel === 'css', 'has-error': hasPanelError('css') }"
          @click="selectPanel('css')"
          title="CSS 樣式表檔案"
        >
          <span class="file-icon icon-css">#</span>
          <span class="file-name">style.css</span>
          <span v-if="hasPanelError('css')" class="vsc-error-badge" title="有未通過項目">!</span>
        </button>

        <button
          type="button"
          class="vsc-tab-btn"
          :class="{ active: activePanel === 'js', 'has-error': hasPanelError('js') }"
          @click="selectPanel('js')"
          title="JavaScript 邏輯檔案"
        >
          <span class="file-icon icon-js">JS</span>
          <span class="file-name">script.js</span>
          <span v-if="hasPanelError('js')" class="vsc-error-badge" title="有未通過項目">!</span>
        </button>
      </div>

      <!-- 右側工具列按鈕 -->
      <div class="vsc-tab-actions">
        <button
          type="button"
          class="vsc-tool-btn"
          @click="formatCurrentCode"
          title="自動排版縮排 (Shift+Tab / Tab)"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="21" y1="10" x2="7" y2="10"></line>
            <line x1="21" y1="6" x2="3" y2="6"></line>
            <line x1="21" y1="14" x2="3" y2="14"></line>
            <line x1="21" y1="18" x2="7" y2="18"></line>
          </svg>
          <span>排版</span>
        </button>

        <button
          type="button"
          class="vsc-tool-btn"
          :class="{ active: isWordWrap }"
          @click="isWordWrap = !isWordWrap"
          title="自動折行開關"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 10 4 15 9 20"></polyline>
            <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
          </svg>
        </button>

        <button
          type="button"
          class="vsc-tool-btn"
          @click="copyCurrentCode"
          title="複製全部代碼"
        >
          <svg v-if="!copySuccessToast" viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span v-else class="copied-text">已複製</span>
        </button>
      </div>
    </div>

    <!-- 色彩預覽快捷列（若代碼中有色彩時顯示） -->
    <div v-if="uniqueColors.length > 0" class="vsc-color-strip">
      <span class="color-strip-label">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"></path>
        </svg>
        色彩預覽 ({{ uniqueColors.length }}):
      </span>
      <div class="color-chips-scroll">
        <button
          v-for="(col, idx) in uniqueColors"
          :key="idx"
          type="button"
          class="vsc-color-chip"
          :title="`點擊開啟調色盤修改 ${col.color} (第 ${col.line} 行)`"
          @click="openColorPicker(col)"
        >
          <span class="chip-swatch" :style="{ backgroundColor: col.color }"></span>
          <span class="chip-text">{{ col.color }}</span>
        </button>
      </div>
    </div>

    <!-- 題目專屬詞語推薦快捷列（若當前題目有指定詞語時顯示） -->
    <div v-if="currentCustomWords.length > 0" class="vsc-custom-words-strip">
      <span class="custom-words-label">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        本題推薦語法 ({{ currentCustomWords.length }}):
      </span>
      <div class="custom-words-scroll">
        <button
          v-for="(w, idx) in currentCustomWords"
          :key="idx"
          type="button"
          class="vsc-custom-word-chip"
          :title="`${w.detail ? w.detail + ' - ' : ''}點擊直接插入代碼`"
          @click="insertCustomWord(w)"
        >
          <span class="chip-star">★</span>
          <span class="chip-label">{{ w.label }}</span>
          <span v-if="w.detail" class="chip-hint">{{ w.detail }}</span>
        </button>
      </div>
    </div>

    <!-- 編輯器主工作區 (行號 Gutter + Textarea) -->
    <div class="vsc-main-stage">
      <!-- 行號列 (Gutter) 與每行色彩標記 -->
      <div ref="gutterRef" class="vsc-gutter">
        <div
          v-for="lineNum in totalLinesCount"
          :key="lineNum"
          class="vsc-gutter-line"
          :class="{
            'is-active': lineNum === cursorLine,
            'has-error': errorLines.has(lineNum),
          }"
        >
          <!-- 該行若有顏色代碼，直接在行號旁顯示色塊與調色盤開關 -->
          <span
            v-if="lineColorsMap[lineNum] && lineColorsMap[lineNum].length > 0"
            class="gutter-color-dot"
            :style="{ backgroundColor: lineColorsMap[lineNum][0].color }"
            :title="`點擊修改顏色 ${lineColorsMap[lineNum][0].color}`"
            @click.stop="openColorPicker(lineColorsMap[lineNum][0])"
          ></span>
          <span v-else class="gutter-dot-placeholder"></span>

          <span class="line-number-text">{{ lineNum }}</span>
        </div>
      </div>

      <!-- 編輯器文字區與目前行高亮層 -->
      <div class="vsc-editor-body">
        <!-- 游標當前行背景高亮 -->
        <div
          class="vsc-active-line-bg"
          :style="{ top: `${12 + (cursorLine - 1) * 24}px` }"
        ></div>

        <!-- 顏色預覽圖層 (在文字流中精確於色彩代碼前渲染色彩色塊) -->
        <div
          ref="backdropRef"
          class="vsc-color-backdrop"
          :class="{ 'word-wrap-enabled': isWordWrap }"
          aria-hidden="true"
        >
          <div
            v-for="row in overlayLines"
            :key="row.lineNum"
            class="vsc-backdrop-line"
          >
            <template v-for="(tok, tIdx) in row.tokens" :key="tIdx">
              <span v-if="tok.isColor && tok.color" class="vsc-inline-chip-anchor">
                <span
                  class="vsc-inline-color-chip"
                  :style="{ backgroundColor: tok.color }"
                  :title="`點擊開啟調色盤修改 ${tok.color}`"
                  @click.stop="tok.match && openColorPicker(tok.match)"
                ></span>
                <span class="vsc-token-text">{{ tok.text }}</span>
              </span>
              <span v-else class="vsc-token-text">{{ tok.text }}</span>
            </template>
            <span v-if="row.tokens.length === 0 || (row.tokens.length === 1 && !row.tokens[0].text)" class="vsc-token-empty">&#8203;</span>
          </div>
        </div>

        <div
          v-if="suggestionQuery && getCompletionContext()?.options.length"
          class="vsc-completion-menu"
          :style="{ top: menuTop, left: menuLeft }"
          role="listbox"
        >
          <button
            v-for="(item, index) in getCompletionContext()?.options || []"
            :key="item.label"
            type="button"
            class="vsc-completion-item"
            :class="{ selected: index === selectedSuggestionIndex, 'is-custom': item.isCustom }"
            role="option"
            :aria-selected="index === selectedSuggestionIndex"
            @mousedown="handleSuggestionMouseDown(item, $event)"
          >
            <div class="completion-main">
              <span v-if="item.isCustom" class="completion-badge">★ 本題</span>
              <span class="completion-label">{{ item.label }}</span>
            </div>
            <span class="completion-detail">{{ item.detail }}</span>
          </button>
          <div class="vsc-completion-hint">
            <span>Tab / Enter 套用</span>
            <span>↑↓ 選擇</span>
            <span>Esc 關閉</span>
          </div>
        </div>

        <!-- 核心編輯 textarea (支援 Tab 縮排、反縮排、快捷鍵) -->
        <textarea
          ref="textareaRef"
          v-model="currentCode"
          class="vsc-code-textarea"
          :class="{ 'word-wrap-enabled': isWordWrap }"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          aria-label="類 VS Code 程式碼編輯器"
          @keydown="handleKeydown"
          @scroll="syncScroll"
          @click="updateCursorInfo"
          @keyup="updateCursorInfo"
          @select="updateCursorInfo"
          @input="updateCursorInfo"
        ></textarea>
      </div>
    </div>

    <!-- VS Code 底部狀態列 (Status Bar) -->
    <div class="vsc-status-bar">
      <div class="vsc-status-left">
        <span class="status-item">
          第 {{ cursorLine }} 行, 第 {{ cursorCol }} 欄
        </span>
        <span v-if="selectedCharCount > 0" class="status-item">
          (已選取 {{ selectedCharCount }} 字元)
        </span>
      </div>

      <div class="vsc-status-right">
        <span class="status-item" title="按下 Tab 鍵將縮排 2 個空格">
          空格: 2
        </span>
        <span class="status-item">
          UTF-8
        </span>
        <span class="status-item status-lang-tag">
          {{ activePanel.toUpperCase() }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vsc-editor-root {
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  border-right: 1px solid #2d2d2d;
  min-width: 0;
  height: 100%;
  position: relative;
  font-family: 'Consolas', 'Fira Code', 'Monaco', 'Courier New', monospace;
  box-sizing: border-box;
  overflow: hidden;
}

/* 編輯器內部所有按鈕（分頁、快捷列、工具按鈕、補全項目等）全面禁止 hover/active 放大 scale，杜絕容器抖動 */
.vsc-editor-root button,
.vsc-editor-root button:hover,
.vsc-editor-root button:active {
  transform: none !important;
}

.vsc-hidden-color-input {
  position: absolute;
  top: -9999px;
  left: -9999px;
  opacity: 0;
  pointer-events: none;
}

/* ── 頂部 VS Code 分頁列 ── */
.vsc-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #252526;
  border-bottom: 1px solid #191919;
  height: 38px;
  flex-shrink: 0;
  user-select: none;
}

.vsc-tabs-list {
  display: flex;
  height: 100%;
  overflow-x: hidden;
  scrollbar-width: none;
}

.vsc-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 100%;
  border: none;
  border-right: 1px solid #1e1e1e;
  background: #2d2d2d;
  color: #969696;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease, color 0.15s ease;
}

.vsc-tab-btn:hover {
  background: #282828;
  color: #cccccc;
}

.vsc-tab-btn.active {
  background: #1e1e1e;
  color: #ffffff;
  border-top: 2px solid #007acc;
  font-weight: 600;
}

.vsc-tab-btn.has-error .file-name {
  color: #f87171;
}

.file-icon {
  font-size: 0.72rem;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-html { color: #ea580c; }
.icon-css  { color: #38bdf8; }
.icon-js   { color: #facc15; }

.vsc-error-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
}

/* 頂部操作小按鈕 */
.vsc-tab-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 10px;
}

.vsc-tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  color: #858585;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}

.vsc-tool-btn:hover {
  background: #333333;
  color: #e2e8f0;
}

.vsc-tool-btn.active {
  color: #38bdf8;
  background: #1e293b;
}

.copied-text {
  color: #4ade80;
}

/* ── 顏色代碼預覽快捷列 ── */
.vsc-color-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #252526;
  border-bottom: 1px solid #333333;
  padding: 5px 12px;
  font-size: 0.72rem;
  color: #a3a3a3;
  flex-shrink: 0;
  overflow: hidden;
}

.color-strip-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  color: #d4d4d4;
  white-space: nowrap;
}

.color-chips-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.color-chips-scroll::-webkit-scrollbar {
  display: none;
}

.vsc-color-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  padding: 2px 7px;
  font-family: inherit;
  font-size: 0.72rem;
  color: #e2e8f0;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.vsc-color-chip:hover {
  border-color: #007acc;
  background: #2a2d2e;
}

.chip-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

.chip-text {
  font-family: inherit;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}

/* ── 核心工作舞台 ── */
.vsc-main-stage {
  display: flex;
  flex: 1;
  min-height: 320px;
  position: relative;
  overflow: hidden;
  background: #1e1e1e;
}

/* 行號列 (Gutter) */
.vsc-gutter {
  width: 52px;
  flex-shrink: 0;
  background: #1e1e1e;
  border-right: 1px solid #2d2d2d;
  user-select: none;
  overflow: hidden;
  padding: 12px 0;
  color: #858585;
}

.vsc-gutter-line {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 24px;
  line-height: 24px;
  padding: 0 8px 0 4px;
  gap: 4px;
  font-size: 0.8125rem;
}

.vsc-gutter-line.is-active {
  color: #ffffff;
  font-weight: 700;
}

.vsc-gutter-line.has-error {
  color: #f87171;
}

.line-number-text {
  width: 24px;
  text-align: right;
  display: inline-block;
}

/* 行號旁的顏色小色塊 (VS Code 樣式) */
.gutter-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.6);
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.gutter-color-dot:hover {
  transform: scale(1.25);
  border-color: #ffffff;
}

.gutter-dot-placeholder {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

/* 編輯區主體 */
.vsc-editor-body {
  flex: 1;
  position: relative;
  min-width: 0;
  overflow: hidden;
}

/* 當前行高亮底色 */
.vsc-active-line-bg {
  position: absolute;
  left: 0;
  right: 0;
  height: 24px;
  background: rgba(255, 255, 255, 0.035);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  pointer-events: none;
  z-index: 1;
}

/* 顏色即時預覽圖層 (浮貼於 textarea 上方，文字透明，僅顏色小方塊可見並可點擊) */
.vsc-color-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 12px 14px;
  box-sizing: border-box;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 24px;
  tab-size: 2;
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  z-index: 3;
}

.vsc-color-backdrop.word-wrap-enabled {
  white-space: pre-wrap;
  word-break: break-all;
}

.vsc-backdrop-line {
  height: 24px;
  line-height: 24px;
  white-space: pre;
}

.vsc-color-backdrop.word-wrap-enabled .vsc-backdrop-line {
  height: auto;
  min-height: 24px;
  white-space: pre-wrap;
}

.vsc-token-text {
  visibility: hidden;
}

.vsc-token-empty {
  visibility: hidden;
}

/* 零位移色塊錨點：寬度 0px，不排版推擠後續文字 */
.vsc-inline-chip-anchor {
  display: inline-flex;
  align-items: center;
  width: 0;
  height: 24px;
  position: relative;
  overflow: visible;
  vertical-align: top;
}

.vsc-inline-color-chip {
  position: absolute;
  right: 2px;
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.85);
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.15s ease, border-color 0.15s ease;
  z-index: 4;
}

.vsc-inline-color-chip:hover {
  transform: scale(1.3);
  border-color: #ffffff;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
}

.vsc-custom-words-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1c2333;
  border-bottom: 1px solid #2d3748;
  padding: 6px 12px;
  font-size: 0.72rem;
  color: #94a3b8;
  flex-shrink: 0;
  overflow: hidden;
}

.custom-words-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 700;
  color: #38bdf8;
  white-space: nowrap;
  font-size: 0.72rem;
}

.custom-words-scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.custom-words-scroll::-webkit-scrollbar {
  display: none;
}

.vsc-custom-word-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 4px;
  padding: 3px 8px;
  font-family: inherit;
  font-size: 0.72rem;
  color: #e2e8f0;
  cursor: pointer;
  white-space: nowrap;
  transform: none !important;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease !important;
}

.vsc-custom-word-chip:hover {
  border-color: #38bdf8;
  background: #1e293b;
  color: #ffffff;
  transform: none !important;
}

.vsc-custom-word-chip:active {
  transform: none !important;
}

.chip-star {
  color: #facc15;
  font-size: 0.7rem;
}

.chip-label {
  font-weight: 600;
  color: #f1f5f9;
}

.chip-hint {
  font-size: 0.65rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 4px;
  border-radius: 2px;
}

/* ── 補全選單樣式 ── */
.vsc-completion-menu {
  position: absolute;
  z-index: 10;
  width: min(340px, calc(100% - 28px));
  max-height: 250px;
  overflow-y: auto;
  padding: 4px;
  background: #252526;
  border: 1px solid #454545;
  border-radius: 5px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6);
  transition: top 0.08s ease, left 0.08s ease;
}

.vsc-completion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 28px;
  padding: 4px 8px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #d4d4d4;
  font: inherit;
  font-size: 0.76rem;
  text-align: left;
  cursor: pointer;
  transform: none !important;
  transition: background 0.08s ease, color 0.08s ease !important;
}

.vsc-completion-item.is-custom {
  background: rgba(56, 189, 248, 0.06);
}

.vsc-completion-item.selected,
.vsc-completion-item:hover {
  background: #094771;
  color: #ffffff;
  transform: none !important;
}

.vsc-completion-item:active {
  transform: none !important;
}

.vsc-completion-item.is-custom.selected {
  background: #0c4a6e;
  transform: none !important;
}

.completion-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.completion-badge {
  font-size: 0.62rem;
  font-weight: 700;
  color: #facc15;
  background: rgba(250, 204, 21, 0.15);
  border: 1px solid rgba(250, 204, 21, 0.3);
  padding: 1px 4px;
  border-radius: 2px;
  white-space: nowrap;
}

.completion-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.completion-detail {
  flex-shrink: 0;
  color: #858585;
  font-size: 0.68rem;
}

.vsc-completion-item.selected .completion-detail,
.vsc-completion-item:hover .completion-detail {
  color: #b8d7ed;
}

.vsc-completion-hint {
  display: flex;
  justify-content: space-between;
  padding: 5px 8px 3px;
  border-top: 1px solid #3c3c3c;
  color: #858585;
  font-size: 0.65rem;
}

/* 核心代碼 Textarea */
.vsc-code-textarea {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: #d4d4d4;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 24px;
  padding: 12px 14px;
  box-sizing: border-box;
  tab-size: 2;
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
  overflow: auto;
  caret-color: #007acc;
  scrollbar-width: thin;
  scrollbar-color: #424242 transparent;
}

.vsc-code-textarea.word-wrap-enabled {
  white-space: pre-wrap;
  word-break: break-all;
}

.vsc-code-textarea::selection {
  background: #264f78;
}

.vsc-code-textarea::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.vsc-code-textarea::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}
.vsc-code-textarea::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}

/* ── 底部 VS Code 藍色狀態列 ── */
.vsc-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #007acc;
  color: #ffffff;
  height: 22px;
  padding: 0 12px;
  font-size: 0.7rem;
  font-family: inherit;
  flex-shrink: 0;
  user-select: none;
}

.vsc-status-left,
.vsc-status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.status-lang-tag {
  background: rgba(0, 0, 0, 0.2);
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
