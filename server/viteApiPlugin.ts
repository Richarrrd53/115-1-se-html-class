import type { Plugin } from 'vite'
import { aiQueue } from './aiQueue.ts'
import { findLocalMember } from '../src/courseMembers.ts'

export function viteApiPlugin(): Plugin {
  return {
    name: 'vite-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || ''
        if (!rawUrl.startsWith('/api/')) {
          return next()
        }

        const url = rawUrl.split('?')[0]

        // 佇列狀態查詢
        if (url === '/api/ai/queue-status') {
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              isBusy: aiQueue.isBusy,
              queueLength: aiQueue.queueLength,
            })
          )
          return
        }

        // Vertex AI 實作練習驗證
        if (url === '/api/ai/verify-practice' && req.method === 'POST') {
          let bodyStr = ''
          req.on('data', (chunk) => {
            bodyStr += chunk
          })
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}')
              const result = await aiQueue.enqueue(body)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true, ...result }))
            } catch (err: any) {
              const errMsg = String(err?.message || err)
              const is429 =
                errMsg.includes('429') ||
                errMsg.includes('RESOURCE_EXHAUSTED') ||
                errMsg.includes('quota') ||
                errMsg.includes('Too Many Requests')
              res.statusCode = is429 ? 429 : 500
              res.setHeader('Content-Type', 'application/json')
              res.end(
                JSON.stringify({
                  success: false,
                  error: is429 ? '伺服器繁忙，正在排隊中...' : errMsg,
                  isQueued: is429,
                })
              )
            }
          })
          return
        }

        // 學員名冊驗證
        if (url === '/api/members/verify' && req.method === 'POST') {
          let bodyStr = ''
          req.on('data', (chunk) => {
            bodyStr += chunk
          })
          req.on('end', () => {
            try {
              const body = JSON.parse(bodyStr || '{}')
              const member = findLocalMember(body.studentId, body.name)
              res.setHeader('Content-Type', 'application/json')
              if (member) {
                res.end(JSON.stringify({ valid: true, member }))
              } else {
                res.end(
                  JSON.stringify({
                    valid: false,
                    error: '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！',
                  })
                )
              }
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ valid: false, error: '請求格式錯誤' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}
