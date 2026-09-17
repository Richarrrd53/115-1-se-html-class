import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Pool } from 'pg'

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

  sendJson(response, 404, { error: 'Not found' })
})

server.listen(port, () => console.log(`Practice API listening on http://localhost:${port}`))
