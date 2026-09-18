import type { VercelRequest, VercelResponse } from '@vercel/node'
import { findLocalMember } from '../../src/courseMembers'

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body || {}
  const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!studentId || !name) {
    return res.status(400).json({ valid: false, error: '請輸入學號與姓名。' })
  }

  const member = findLocalMember(studentId, name)
  if (member) {
    return res.status(200).json({ valid: true, member })
  }

  return res.status(200).json({
    valid: false,
    error: '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！'
  })
}
