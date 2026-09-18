import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Pool } from 'pg'
import { normalizeName, normalizeStudentId, findLocalMember, COURSE_MEMBERS } from '../src/courseMembers'
import { aiQueue } from './aiQueue'

const port = Number(process.env.PORT || 3001)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(JSON.stringify(body))
}

async function readBody(request: IncomingMessage) {
  let body = ''
  for await (const chunk of request) body += chunk
  return JSON.parse(body || '{}') as Record<string, unknown>
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' })
    response.end()
    return
  }

  if (request.url?.startsWith('/api/practice') && request.method === 'GET') {
    const lessonId = new URL(request.url, `http://${request.headers.host}`).searchParams.get('lessonId')
    const result = await pool.query(
      `SELECT s.name, p.lesson_id AS "lessonId", p.completed_at IS NOT NULL AS completed,
              p.last_seen_at AS "lastSeenAt"
       FROM practice_sessions p JOIN students s ON s.id = p.student_id
       WHERE ($1::text IS NULL OR p.lesson_id = $1)
       ORDER BY p.last_seen_at DESC`,
      [lessonId],
    )
    sendJson(response, 200, result.rows)
    return
  }

  if (request.url === '/api/practice' && request.method === 'POST') {
    try {
      const body = await readBody(request)
      const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : ''
      const lessonId = typeof body.lessonId === 'string' ? body.lessonId.trim() : ''
      const completed = body.completed === true
      if (!studentName || !lessonId || studentName.length > 80 || lessonId.length > 80) {
        sendJson(response, 400, { error: 'studentName and lessonId are required' })
        return
      }
      const result = await pool.query(
        `INSERT INTO students (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [studentName],
      )
      const student = result.rows[0]
      const session = await pool.query(
        `INSERT INTO practice_sessions (student_id, lesson_id, completed_at)
         VALUES ($1, $2, CASE WHEN $3 THEN now() ELSE NULL END)
         ON CONFLICT (student_id, lesson_id) DO UPDATE SET
           last_seen_at = now(),
           completed_at = CASE WHEN $3 THEN COALESCE(practice_sessions.completed_at, now()) ELSE practice_sessions.completed_at END
         RETURNING lesson_id AS "lessonId", completed_at IS NOT NULL AS completed, last_seen_at AS "lastSeenAt"`,
        [student.id, lessonId, completed],
      )
      sendJson(response, 200, { name: student.name, ...session.rows[0] })
      return
    } catch (error) {
      console.error(error)
      sendJson(response, 500, { error: 'Unable to record practice' })
      return
    }
  }

  if (request.url === '/api/auth/verify' && request.method === 'POST') {
    try {
      const body = await readBody(request)
      const passwordHash = typeof body.passwordHash === 'string' ? body.passwordHash.trim().toLowerCase() : ''
      if (!passwordHash) {
        sendJson(response, 400, { error: 'passwordHash is required' })
        return
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_auth (
          id BIGSERIAL PRIMARY KEY,
          role VARCHAR(40) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        INSERT INTO admin_auth (role, password_hash)
        VALUES ('editor', 'a93bc952f6411dc3dc71a05bd138be30e5d6369ef94acdb98f55260141ef6b21')
        ON CONFLICT (role) DO NOTHING;
      `)
      const result = await pool.query(
        `SELECT password_hash FROM admin_auth WHERE role = 'editor' LIMIT 1`,
      )
      const correctHash = result.rows[0]?.password_hash || 'a93bc952f6411dc3dc71a05bd138be30e5d6369ef94acdb98f55260141ef6b21'
      const isValid = passwordHash === correctHash.toLowerCase()
      sendJson(response, 200, { success: isValid })
      return
    } catch (error) {
      console.error('資料庫查詢錯誤，採用安全比對', error)
      sendJson(response, 200, { success: false, error: 'Database query error' })
      return
    }
  }

  if (request.url === '/api/members/verify' && request.method === 'POST') {
    try {
      const body = await readBody(request)
      const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!studentId || !name) {
        sendJson(response, 400, { valid: false, error: 'studentId and name are required' })
        return
      }

      const normId = normalizeStudentId(studentId)
      const normName = normalizeName(name)

      // 嘗試從資料庫比對
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS course_members (
            id BIGSERIAL PRIMARY KEY,
            student_id VARCHAR(40) NOT NULL UNIQUE,
            name VARCHAR(80) NOT NULL,
            email VARCHAR(120),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          );
        `)
        const result = await pool.query(
          `SELECT student_id, name, email FROM course_members WHERE LOWER(TRIM(student_id)) = $1 LIMIT 1`,
          [normId],
        )
        if (result.rows.length > 0) {
          const dbMember = result.rows[0]
          if (normalizeName(dbMember.name) === normName) {
            sendJson(response, 200, {
              valid: true,
              member: {
                studentId: dbMember.student_id,
                name: dbMember.name,
                email: dbMember.email,
              },
            })
            return
          } else {
            sendJson(response, 200, {
              valid: false,
              error: '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！',
            })
            return
          }
        }
      } catch (dbErr) {
        console.warn('資料庫查詢 course_members 失敗，使用內建名冊比對：', dbErr)
      }

      // 內建名冊比對備援
      const member = findLocalMember(studentId, name)
      if (member) {
        sendJson(response, 200, {
          valid: true,
          member,
        })
        return
      }

      sendJson(response, 200, {
        valid: false,
        error: '錯誤！你目前沒有在課程中，請檢查你的學號/姓名是否正確！',
      })
      return
    } catch (error) {
      console.error('驗證失敗：', error)
      sendJson(response, 500, { valid: false, error: 'Internal server error' })
      return
    }
  }

  // 查詢 AI 審核佇列狀態
  if (request.url === '/api/ai/queue-status' && request.method === 'GET') {
    sendJson(response, 200, {
      isBusy: aiQueue.isBusy,
      queueLength: aiQueue.queueLength,
    })
    return
  }

  // Gemini 智能代碼審核與評分端點
  if (request.url === '/api/ai/verify-practice' && request.method === 'POST') {
    try {
      const body = await readBody(request)
      const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
      const studentName = typeof body.studentName === 'string' ? body.studentName.trim() : ''
      const lessonId = typeof body.lessonId === 'string' ? body.lessonId.trim() : ''
      const lessonTitle = typeof body.lessonTitle === 'string' ? body.lessonTitle.trim() : ''
      const lessonObjective = typeof body.lessonObjective === 'string' ? body.lessonObjective.trim() : ''
      const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : ''
      const checklist = Array.isArray(body.checklist) ? (body.checklist as string[]) : []
      const starterCode = (body.starterCode as any) || {}
      const answerCode = (body.answerCode as any) || {}
      const studentCode = (body.studentCode as any) || { html: '', css: '', js: '' }

      if (!studentId || !studentName) {
        sendJson(response, 400, {
          success: false,
          error: '請先填寫並驗證學號與姓名。',
        })
        return
      }

      // 調用 AI 佇列審核
      const result = await aiQueue.enqueue({
        lessonTitle: lessonTitle || `單元 ${lessonId}`,
        lessonObjective,
        instructions,
        checklist,
        starterCode,
        answerCode,
        studentCode,
      })

      // 若通過或評分成功，嘗試寫入資料庫
      try {
        await pool.query(`
          ALTER TABLE practice_submissions ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;
          ALTER TABLE practice_submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
        `)
        await pool.query(
          `INSERT INTO practice_submissions (student_id, student_name, lesson_id, code, completed, score, ai_feedback)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            studentId,
            studentName,
            lessonId,
            JSON.stringify(studentCode),
            result.passed,
            result.score,
            result.feedback || result.summary,
          ],
        )
      } catch (dbErr) {
        console.warn('寫入 practice_submissions 資料庫失敗（非致命，前端會同步寫入 Supabase）：', dbErr)
      }

      sendJson(response, 200, {
        success: true,
        ...result,
      })
      return
    } catch (error: any) {
      console.error('Gemini 審核端點異常：', error)
      const isRateLimit =
        String(error?.message || error).includes('429') ||
        String(error?.message || error).includes('RESOURCE_EXHAUSTED') ||
        String(error?.message || error).includes('quota')

      sendJson(response, isRateLimit ? 429 : 500, {
        success: false,
        error: isRateLimit ? 'RATE_LIMIT' : 'AI_ERROR',
        message: isRateLimit
          ? '伺服器繁忙，正在排隊審核中，請稍候重試。'
          : `AI 評核失敗：${error?.message || '未知錯誤'}`,
      })
      return
    }
  }

  // 管理員模式：查詢所有學生之成績、進度與上線時長
  if (request.url === '/api/admin/students' && request.method === 'GET') {
    try {
      let dbSubmissions: any[] = []
      let dbSessions: any[] = []
      try {
        const subRes = await pool.query(
          `SELECT student_id, student_name, lesson_id, completed, score, ai_feedback, created_at
           FROM practice_submissions ORDER BY created_at ASC`,
        )
        dbSubmissions = subRes.rows
      } catch {
        // 資料庫未啟用或無該表
      }

      try {
        const sessRes = await pool.query(
          `SELECT student_id, lesson_id, started_at, last_seen_at, completed_at
           FROM practice_sessions`,
        )
        dbSessions = sessRes.rows
      } catch {}

      // 整理 75 位學生名單資料
      const studentMap = new Map<string, any>()
      for (const member of COURSE_MEMBERS) {
        studentMap.set(normalizeStudentId(member.studentId), {
          studentId: member.studentId,
          name: member.name,
          email: member.email || '',
          group: member.group || '',
          lastSeenAt: null,
          onlineDurationMinutes: 0,
          scores: {} as Record<string, number>,
          completedLessons: {} as Record<string, boolean>,
          completedCount: 0,
          averageScore: 0,
          submissionsCount: 0,
        })
      }

      // 合併提交成績
      for (const sub of dbSubmissions) {
        const normId = normalizeStudentId(sub.student_id)
        if (!studentMap.has(normId)) {
          studentMap.set(normId, {
            studentId: sub.student_id,
            name: sub.student_name,
            email: '',
            group: '',
            lastSeenAt: sub.created_at,
            onlineDurationMinutes: 0,
            scores: {},
            completedLessons: {},
            completedCount: 0,
            averageScore: 0,
            submissionsCount: 0,
          })
        }
        const st = studentMap.get(normId)
        st.submissionsCount++
        if (typeof sub.score === 'number' && sub.score > 0) {
          st.scores[sub.lesson_id] = Math.max(st.scores[sub.lesson_id] || 0, sub.score)
        }
        if (sub.completed) {
          st.completedLessons[sub.lesson_id] = true
        }
        if (!st.lastSeenAt || new Date(sub.created_at) > new Date(st.lastSeenAt)) {
          st.lastSeenAt = sub.created_at
        }
      }

      // 合併工作階段上線時間
      for (const sess of dbSessions) {
        const normId = normalizeStudentId(String(sess.student_id))
        const st = studentMap.get(normId)
        if (st) {
          if (!st.lastSeenAt || new Date(sess.last_seen_at) > new Date(st.lastSeenAt)) {
            st.lastSeenAt = sess.last_seen_at
          }
          if (sess.started_at && sess.last_seen_at) {
            const diffMin = Math.round(
              (new Date(sess.last_seen_at).getTime() - new Date(sess.started_at).getTime()) / 60000,
            )
            if (diffMin > 0) st.onlineDurationMinutes += diffMin
          }
        }
      }

      // 計算統計數據
      const studentList = Array.from(studentMap.values()).map((st) => {
        st.completedCount = Object.values(st.completedLessons).filter(Boolean).length
        const scoreValues = Object.values(st.scores) as number[]
        st.averageScore = scoreValues.length
          ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
          : 0
        return st
      })

      sendJson(response, 200, studentList)
      return
    } catch (error) {
      console.error('查詢學生成績失敗：', error)
      sendJson(response, 500, { error: 'Failed to fetch student data' })
      return
    }
  }

  // 管理員模式：更新學生成績、上線時長與資料
  if (request.url === '/api/admin/students' && request.method === 'PUT') {
    try {
      const body = await readBody(request)
      const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : ''
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const scores = (body.scores as Record<string, number>) || {}
      const completedLessons = (body.completedLessons as Record<string, boolean>) || {}
      const onlineDurationMinutes = Number(body.onlineDurationMinutes || 0)
      const lastSeenAt = body.lastSeenAt || new Date().toISOString()

      if (!studentId) {
        sendJson(response, 400, { error: 'studentId is required' })
        return
      }

      // 若有提供姓名修改，同步更新 course_members
      if (name) {
        try {
          await pool.query(
            `UPDATE course_members SET name = $1 WHERE student_id = $2`,
            [name, studentId],
          )
        } catch {}
      }

      // 同步更新或新增 practice_submissions
      for (const [lessonId, score] of Object.entries(scores)) {
        const completed = completedLessons[lessonId] || score >= 80
        try {
          await pool.query(
            `INSERT INTO practice_submissions (student_id, student_name, lesson_id, code, completed, score, online_duration_minutes)
             VALUES ($1, $2, $3, '{}', $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               score = EXCLUDED.score,
               completed = EXCLUDED.completed,
               online_duration_minutes = EXCLUDED.online_duration_minutes`,
            [studentId, name || '學生', lessonId, completed, score, onlineDurationMinutes],
          )
        } catch (dbErr) {
          console.warn('更新單元成績失敗：', dbErr)
        }
      }

      sendJson(response, 200, { success: true })
      return
    } catch (error) {
      console.error('更新學生資料失敗：', error)
      sendJson(response, 500, { error: 'Failed to update student' })
      return
    }
  }

  sendJson(response, 404, { error: 'Not found' })
})


server.listen(port, () => console.log(`Practice API listening on http://localhost:${port}`))
