import { marked } from 'marked'

// 配置 marked 選項
marked.setOptions({
  gfm: true,
  breaks: true,
})

/**
 * 完整渲染 Markdown（支援多段落、清單、代碼塊、粗體等）
 */
export function renderMarkdown(content: string | undefined | null): string {
  if (!content) return ''
  try {
    return marked.parse(content, { async: false }) as string
  } catch (err) {
    console.error('Markdown 渲染錯誤:', err)
    return content
  }
}

/**
 * 行內渲染 Markdown（不包覆最外層的 <p> 標籤，適合單行說明或清單項目）
 */
export function renderInlineMarkdown(content: string | undefined | null): string {
  if (!content) return ''
  try {
    return marked.parseInline(content, { async: false }) as string
  } catch (err) {
    console.error('Markdown 行內渲染錯誤:', err)
    return content
  }
}
