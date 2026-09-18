import { marked, type Tokens } from 'marked'

// 配置 marked 選項
marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * 安全轉義 HTML 特殊符號（防護兜底）
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 兜底防護：攔截 marked 識別到的所有未轉義 HTML Token，避免直接作為 DOM 注入頁面破壞結構
marked.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      const content = typeof text === 'string' ? text : ''
      return `<code>${escapeHtml(content)}</code>`
    },
  },
})

/**
 * 將文字中可能的字面轉義字串（如 \\n、\\r\\n、\\t）轉換為真實功能符號（換行、縮排）
 */
export function formatNewlines(content: string | undefined | null): string {
  if (!content) return ''
  return content
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
}

/**
 * 自動偵測 Markdown 中未被反引號包覆的 HTML 標籤（如 <body>、<h1>標題</h1>、<div class="..."> 等），
 * 並將其自動包上反引號（`...`），避免破壞頁面 DOM 結構並確保以代碼樣式（灰底圓角矩形）安全呈現。
 */
export function autoWrapHtmlTagsInMarkdown(content: string | undefined | null): string {
  if (!content) return ''

  // 1. 保留已存在的代碼塊（```...``` 或 ~~~...~~~）與行內代碼（`...`），絕不重複包覆
  const CODE_SPLIT_REGEX = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`+[^`]*?`+)/g
  const parts = content.split(CODE_SPLIT_REGEX)

  // 判斷成對標籤中間是否為自然中文語句（例如 "請確認 <a> 標籤與 </a> 是否成對"）
  const isProse = (inner: string | undefined): boolean => {
    if (!inner || inner.length > 80) return true
    if (/[，。！？；：、]/.test(inner)) return true
    if (/(?:標籤|元素|屬性|以及|與|或|和|tag|element)/i.test(inner)) return true
    return false
  }

  // 標籤對正規表達式：例如 <h1>我的網頁</h1> 或 <code>代碼</code>
  const TAG_PAIR = /<(?<tag>[a-zA-Z][a-zA-Z0-9:-]*)(?:\s+[^"'>/]+|"[^"]*"|'[^']*')*\s*>(?<inner>[^<\n]+)<\/\k<tag>>/
  // 單一或自閉合標籤正規表達式：例如 <!DOCTYPE html>、<!-- ... -->、<body>、</p>、<input .../>
  const SINGLE_TAG = /(?:<!DOCTYPE(?:\s+[^"'>/]+|"[^"]*"|'[^']*')*\s*>|<!--[\s\S]*?-->|<\/?[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^"'>/]+|"[^"]*"|'[^']*')*\s*\/?>)/
  const COMBINED = new RegExp(`(?<pair>${TAG_PAIR.source})|(?<single>${SINGLE_TAG.source})`, 'gi')

  for (let i = 0; i < parts.length; i += 2) {
    const text = parts[i]
    if (!text) continue

    parts[i] = text.replace(COMBINED, (match, ...rest) => {
      const groups = rest[rest.length - 1] as
        | { pair?: string; tag?: string; inner?: string; single?: string }
        | undefined
      if (groups?.pair) {
        if (isProse(groups.inner)) {
          // 若中間為文字說明，將開頭與結尾標籤分別包覆
          const openTagMatch = match.match(/^<[a-zA-Z][a-zA-Z0-9:-]*(?:\s+[^"'>/]+|"[^"]*"|'[^']*')*\s*>/)
          const closeTagMatch = match.match(/<\/[a-zA-Z][a-zA-Z0-9:-]*\s*>$/)
          if (openTagMatch && closeTagMatch) {
            const open = openTagMatch[0]
            const close = closeTagMatch[0]
            const middle = match.slice(open.length, match.length - close.length)
            return `\`${open}\`${middle}\`${close}\``
          }
        }
        return `\`${match}\``
      }
      return `\`${match}\``
    })
  }

  return parts.join('')
}

/**
 * 完整渲染 Markdown（支援多段落、清單、代碼塊、粗體等，自動轉換 \\n 換行並安全包覆 HTML 標籤）
 */
export function renderMarkdown(content: string | undefined | null): string {
  if (!content) return ''
  try {
    const formatted = formatNewlines(content)
    const sanitized = autoWrapHtmlTagsInMarkdown(formatted)
    return marked.parse(sanitized, { async: false }) as string
  } catch (err) {
    console.error('Markdown 渲染錯誤:', err)
    return content
  }
}

/**
 * 行內渲染 Markdown（不包覆最外層的 <p> 標籤，適合單行說明或清單項目，自動轉換 \\n 換行並安全包覆 HTML 標籤）
 */
export function renderInlineMarkdown(content: string | undefined | null): string {
  if (!content) return ''
  try {
    const formatted = formatNewlines(content)
    const sanitized = autoWrapHtmlTagsInMarkdown(formatted)
    return marked.parseInline(sanitized, { async: false }) as string
  } catch (err) {
    console.error('Markdown 行內渲染錯誤:', err)
    return content
  }
}
