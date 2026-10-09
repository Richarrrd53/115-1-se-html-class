import { ref } from 'vue'
import { supabase } from './supabase'

export interface SqlUnit {
  id: string
  number?: number
  title: string
  objective: string
  concept: string
  tableName: string
  columns: string[]
  rows: string[][]
  question: string
  starter: string
  answer: string
  checklist: string[]
  hasExercise?: boolean
  reviewPoints?: Array<{ title: string; body: string; example: string }>
}

export const defaultSqlLessons: SqlUnit[] = [
  {
    id: 'overview',
    title: '總複習',
    objective: '先快速回顧 SQL 查詢的基本結構與常用觀念，再進入各主題練習。',
    concept: 'SQL 用來描述要從資料表取得或修改哪些資料。依序組合查詢子句，就能篩選、整理並連結資料。',
    tableName: '',
    columns: [],
    rows: [],
    question: '',
    starter: '',
    answer: '',
    checklist: [],
    hasExercise: false,
    reviewPoints: [
      { title: '基本查詢', body: 'SELECT 指定輸出欄位，FROM 指定資料表。', example: 'SELECT name, grade\nFROM student;' },
      { title: '條件篩選', body: 'WHERE 篩選資料列；可搭配 AND、OR、IN、BETWEEN、LIKE。', example: "SELECT name\nFROM student\nWHERE grade >= 60 AND class = '甲班';" },
      { title: '分組與彙總', body: 'GROUP BY 分組；COUNT、AVG、SUM、MAX、MIN 可計算每組摘要。HAVING 篩選分組後的結果。', example: 'SELECT class, AVG(grade)\nFROM student\nGROUP BY class\nHAVING AVG(grade) >= 60;' },
      { title: '排序與筆數', body: 'ORDER BY 排序，DESC 為遞減、ASC 為遞增；LIMIT 與 OFFSET 控制回傳筆數與略過筆數。', example: 'SELECT name, grade\nFROM student\nORDER BY grade DESC\nLIMIT 5 OFFSET 0;' },
      { title: '資料表關聯', body: 'JOIN ... ON 依關聯欄位連接資料表。PK 唯一識別資料；FK 指向另一張表的 PK。', example: 'SELECT student.name, enroll.grade\nFROM student\nJOIN enroll ON student.stuid = enroll.stuid;' },
      { title: '子查詢與 CTE', body: '子查詢可放在條件或資料來源中；WITH 可替中間查詢命名，讓較長的查詢更清楚。', example: 'WITH class_avg AS (\n  SELECT class, AVG(grade) AS avg_grade\n  FROM student\n  GROUP BY class\n)\nSELECT * FROM class_avg;' },
      { title: '資料表操作', body: 'CRUD 分別是新增、讀取、修改、刪除。修改與刪除資料時要確認 WHERE 條件。', example: "INSERT INTO student (stuid, name) VALUES ('S001', '小明');\nUPDATE student SET name = '明明' WHERE stuid = 'S001';\nDELETE FROM student WHERE stuid = 'S001';" },
      { title: 'PostgreSQL 日期與型別', body: "date_part 可取日期的年、月、日；::type 或 CAST(... AS type) 可轉換型別。CURRENT_DATE 是目前日期，NOW() 是目前日期與時間。", example: "SELECT date_part('year', birthday)::integer AS birth_year,\n       CURRENT_DATE\nFROM student;" },
    ],
  },
  {
    id: 'filter-group',
    title: '篩選與分組',
    objective: '練習 WHERE 篩選資料，並用 GROUP BY 與 HAVING 整理分組結果。',
    concept: '查詢常見順序是 FROM、WHERE、GROUP BY、HAVING、ORDER BY、LIMIT。WHERE 篩選分組前的資料；HAVING 篩選 GROUP BY 產生的彙總結果。',
    tableName: 'enroll（選課成績）',
    columns: ['stuid', 'cid', 'grade'],
    rows: [['S001', 'CS101', '92'], ['S002', 'CS101', '55'], ['S003', 'CS101', '48'], ['S004', 'DB201', '87']],
    question: '找出每門課不及格（grade < 60）的人數，只列出不及格人數至少 2 人的課程編號。',
    starter: 'SELECT cid, COUNT(*) AS failed_count\nFROM enroll\n-- 加上篩選、分組與群組條件',
    answer: 'SELECT cid, COUNT(*) AS failed_count\nFROM enroll\nWHERE grade < 60\nGROUP BY cid\nHAVING COUNT(*) >= 2;',
    checklist: ['使用 SELECT 選出課程編號與不及格人數', '使用 WHERE 篩選 grade < 60', '依 cid 使用 GROUP BY 分組', '使用 HAVING 篩選人數至少 2 人'],
  },
  {
    id: 'join',
    title: 'JOIN 多表查詢',
    objective: '依照主鍵與外鍵，把學生、選課與課程資料連在一起。',
    concept: 'JOIN ... ON 依主鍵（PK）與外鍵（FK）等關聯欄位連接資料。INNER JOIN 只保留兩邊相符的資料；LEFT JOIN 會保留左表中沒有相符資料的列。',
    tableName: 'student · enroll · course',
    columns: ['資料表', '關聯欄位', '用途'],
    rows: [['student', 'stuid', '學生資料'], ['enroll', 'stuid、cid', '選課與成績'], ['course', 'cid', '課程資料']],
    question: '列出每位學生的姓名、課程名稱與成績。student 以 stuid 連接 enroll，course 以 cid 連接 enroll。',
    starter: 'SELECT student.name, course.coursename, enroll.grade\nFROM student\n-- 連接 enroll 與 course',
    answer: 'SELECT student.name, course.coursename, enroll.grade\nFROM student\nJOIN enroll ON student.stuid = enroll.stuid\nJOIN course ON enroll.cid = course.cid;',
    checklist: ['選出學生姓名、課程名稱與成績', 'JOIN student 與 enroll，使用 stuid 作為關聯欄位', 'JOIN enroll 與 course，使用 cid 作為關聯欄位'],
  },
  {
    id: 'cte',
    title: 'CTE 分段查詢',
    objective: '使用 WITH 將中間查詢命名，再查詢整理後的結果。',
    concept: 'CTE（Common Table Expression）以 WITH 名稱 AS (查詢) 定義，只在這一次 SQL 查詢中有效。可先命名中間結果，再於後續 SELECT 使用，讓多步驟查詢更容易閱讀。',
    tableName: 'enroll（選課成績）',
    columns: ['stuid', 'cid', 'grade'],
    rows: [['S001', 'CS101', '92'], ['S002', 'CS101', '55'], ['S003', 'DB201', '88'], ['S004', 'DB201', '76']],
    question: '先計算每門課的平均成績，再列出平均成績至少 80 分的課程與平均分數。',
    starter: 'WITH course_average AS (\n  SELECT cid, AVG(grade) AS avg_grade\n  FROM enroll\n  GROUP BY cid\n)\nSELECT cid, avg_grade\nFROM course_average\n-- 加上平均成績條件',
    answer: 'WITH course_average AS (\n  SELECT cid, AVG(grade) AS avg_grade\n  FROM enroll\n  GROUP BY cid\n)\nSELECT cid, avg_grade\nFROM course_average\nWHERE avg_grade >= 80;',
    checklist: ['使用 WITH 定義 course_average', '在 CTE 中依 cid 分組並計算 AVG(grade)', '從 course_average 查詢 cid 與 avg_grade', '篩選 avg_grade >= 80'],
  },
  {
    id: 'postgres',
    title: 'PostgreSQL 日期與型別',
    objective: '用 PostgreSQL 日期函式取出年份，並練習將結果轉成指定型別。',
    concept: "PostgreSQL 可用 date_part('year', birthday) 取出日期年份，並以 ::integer 或 CAST(... AS integer) 轉成整數。也可用 CURRENT_DATE 取得目前日期、NOW() 取得目前日期與時間。",
    tableName: 'student（學生資料）',
    columns: ['name', 'birthday'],
    rows: [['小安', '2005-03-12'], ['小美', '2004-11-28'], ['小宇', '2005-07-06']],
    question: '從 student 表列出姓名與生日年份，並將 date_part 的結果轉成 integer，欄位別名設為 birth_year。',
    starter: 'SELECT name,\n       -- 取出年份並轉成整數\nFROM student;',
    answer: "SELECT name,\n       date_part('year', birthday)::integer AS birth_year\nFROM student;",
    checklist: ["使用 date_part('year', birthday) 取年份", '使用 ::integer 或 CAST 轉成 integer', '欄位別名為 birth_year', '資料來源為 student'],
  },
]


const STORAGE_KEY = 'webcraft_sql_lessons_v1'

function cloneSqlLessons(source: SqlUnit[] = defaultSqlLessons): SqlUnit[] {
  return JSON.parse(JSON.stringify(source)) as SqlUnit[]
}

function loadSqlLessons(): SqlUnit[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length) return parsed
    }
  } catch (error) {
    console.warn('讀取 SQL 教材失敗，改用預設單元', error)
  }
  return cloneSqlLessons()
}

export const sqlLessons = ref<SqlUnit[]>(loadSqlLessons())

export function saveSqlCourseData(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sqlLessons.value))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('webcraft-sql-data-changed', { detail: cloneSqlLessons(sqlLessons.value) }))
    }
  } catch (error) {
    console.warn('儲存 SQL 教材至本機失敗：', error)
  }
}

export function resetSqlCourseData(): void {
  sqlLessons.value = cloneSqlLessons()
  saveSqlCourseData()
}

export async function saveSqlCourseDataToDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase.from('practice_submissions').insert({
      student_id: '__SYSTEM_COURSE_DATA__',
      student_name: 'COURSE_DATA',
      lesson_id: 'sql-current',
      code: JSON.stringify({ sqlLessons: sqlLessons.value }),
    })
    if (error) throw error
    return { success: true, message: 'SQL 教材已同步儲存至雲端！' }
  } catch (error: any) {
    console.warn('儲存 SQL 教材至雲端失敗：', error)
    return { success: false, message: 'SQL 教材雲端儲存失敗：' + (error?.message || '未知錯誤') }
  }
}

export async function syncSqlCourseDataFromDatabase(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('practice_submissions')
      .select('code, created_at')
      .eq('student_id', '__SYSTEM_COURSE_DATA__')
      .eq('lesson_id', 'sql-current')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data?.code) return false
    const stored = typeof data.code === 'string' ? JSON.parse(data.code) : data.code
    if (!Array.isArray(stored?.sqlLessons) || !stored.sqlLessons.length) return false
    sqlLessons.value = stored.sqlLessons
    saveSqlCourseData()
    return true
  } catch (error) {
    console.warn('從雲端讀取 SQL 教材失敗：', error)
    return false
  }
}
