export type PracticeStudent = {
  name: string
  lessonId: string
  completed: boolean
  lastSeenAt: string
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export async function recordPractice(studentName: string, lessonId: string, completed = false) {
  const response = await fetch('/api/practice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentName, lessonId, completed }),
  })
  return parseResponse<PracticeStudent>(response)
}

export async function fetchPracticeStudents(lessonId: string) {
  const response = await fetch(`/api/practice?lessonId=${encodeURIComponent(lessonId)}`)
  return parseResponse<PracticeStudent[]>(response)
}
