CREATE TABLE IF NOT EXISTS students (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS practice_sessions (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id VARCHAR(80) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS practice_sessions_lesson_id_idx ON practice_sessions (lesson_id);

CREATE TABLE IF NOT EXISTS practice_submissions (
  id BIGSERIAL PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  student_name VARCHAR(80) NOT NULL,
  lesson_id VARCHAR(80) NOT NULL,
  code TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  score INT DEFAULT 0,
  ai_feedback TEXT,
  online_duration_minutes INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE practice_submissions ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE;
ALTER TABLE practice_submissions ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;
ALTER TABLE practice_submissions ADD COLUMN IF NOT EXISTS ai_feedback TEXT;
ALTER TABLE practice_submissions ADD COLUMN IF NOT EXISTS online_duration_minutes INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS practice_submissions_lesson_id_idx ON practice_submissions (lesson_id);

ALTER TABLE practice_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read practice submissions" ON practice_submissions;
CREATE POLICY "Anyone can read practice submissions"
  ON practice_submissions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can submit practice" ON practice_submissions;
CREATE POLICY "Anyone can submit practice"
  ON practice_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update practice" ON practice_submissions;
CREATE POLICY "Anyone can update practice"
  ON practice_submissions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 管理員驗證資料表，密碼為 33550336 的 SHA-256 Hash
CREATE TABLE IF NOT EXISTS admin_auth (
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(40) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_auth (role, password_hash)
VALUES ('editor', 'a93bc952f6411dc3dc71a05bd138be30e5d6369ef94acdb98f55260141ef6b21')
ON CONFLICT (role) DO UPDATE SET password_hash = EXCLUDED.password_hash;

ALTER TABLE admin_auth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can verify admin auth" ON admin_auth;
CREATE POLICY "Anyone can verify admin auth"
  ON admin_auth FOR SELECT
  TO anon, authenticated
  USING (true);

-- 課程成員名單資料表
CREATE TABLE IF NOT EXISTS course_members (
  id BIGSERIAL PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_members_student_id_idx ON course_members (student_id);

INSERT INTO course_members (student_id, name, email)
VALUES
  ('113213081', '何彥緻', 's113213081@ncnu.edu.tw'),
  ('113213047', '余秉軒', 's113213047@ncnu.edu.tw'),
  ('113213018', '余采霏', 's113213018@ncnu.edu.tw'),
  ('113213056', '傅宇呈', 's113213056@ncnu.edu.tw'),
  ('112321081', '傅詰閔', 's112321081@ncnu.edu.tw'),
  ('113213067', '劉宜欣', 's113213067@ncnu.edu.tw'),
  ('113213006', '劉采蓁', 's113213006@ncnu.edu.tw'),
  ('112213077', '卓柏睿', 's112213077@ncnu.edu.tw'),
  ('113213054', '卓進幸', 's113213054@ncnu.edu.tw'),
  ('113251027', '吳凱祐', 's113251027@ncnu.edu.tw'),
  ('113213070', '吳芳慈', 's113213070@ncnu.edu.tw'),
  ('113213024', '宋政賢', 's113213024@ncnu.edu.tw'),
  ('113213053', '張婷婷', 's113213053@ncnu.edu.tw'),
  ('113213057', '張媛淇', 's113213057@ncnu.edu.tw'),
  ('113213061', '張庭綸', 's113213061@ncnu.edu.tw'),
  ('113251007', '張慶宇', 's113251007@ncnu.edu.tw'),
  ('113213029', '張靖程', 's113213029@ncnu.edu.tw'),
  ('113213002', '文鈺棼', 's113213002@ncnu.edu.tw'),
  ('113213040', '李嘉鋒', 's113213040@ncnu.edu.tw'),
  ('113213036', '李關關', 's113213036@ncnu.edu.tw'),
  ('111213077', '林冠伶', 's111213077@ncnu.edu.tw'),
  ('114213526', '林柏成', 's114213526@ncnu.edu.tw'),
  ('113213023', '林毓琦', 's113213023@ncnu.edu.tw'),
  ('113251036', '林泓諭', 's113251036@ncnu.edu.tw'),
  ('113213075', '柯宥澤', 's113213075@ncnu.edu.tw'),
  ('113213017', '江科甫', 's113213017@ncnu.edu.tw'),
  ('113213071', '沈睿恆', 's113213071@ncnu.edu.tw'),
  ('113213077', '温佳哲', 's113213077@ncnu.edu.tw'),
  ('113213015', '王世儀', 's113213015@ncnu.edu.tw'),
  ('113213032', '王奕惟', 's113213032@ncnu.edu.tw'),
  ('112213022', '王子豪', 's112213022@ncnu.edu.tw'),
  ('113213001', '王心妍', 's113213001@ncnu.edu.tw'),
  ('113213076', '王志騰', 's113213076@ncnu.edu.tw'),
  ('113251038', '王敬浩', 's113251038@ncnu.edu.tw'),
  ('113213033', '王齡玉', 's113213033@ncnu.edu.tw'),
  ('112251004', '畢維展', 's112251004@ncnu.edu.tw'),
  ('113213064', '盧德展', 's113213064@ncnu.edu.tw'),
  ('113213026', '石鑫', 's113213026@ncnu.edu.tw'),
  ('112213068', '莊佩諺', 's112213068@ncnu.edu.tw'),
  ('113213005', '莫舒安', 's113213005@ncnu.edu.tw'),
  ('112321022', '蔡尚恩', 's112321022@ncnu.edu.tw'),
  ('113213013', '蔡承軒', 's113213013@ncnu.edu.tw'),
  ('113213041', '蔡褍潔', 's113213041@ncnu.edu.tw'),
  ('114213519', '蕭晴澭', 's114213519@ncnu.edu.tw'),
  ('113213078', '薛正裕', 's113213078@ncnu.edu.tw'),
  ('113213069', '蘇資晉', 's113213069@ncnu.edu.tw'),
  ('113213028', '許耘芯', 's113213028@ncnu.edu.tw'),
  ('113213073', '謝宇臻', 's113213073@ncnu.edu.tw'),
  ('113213065', '謝承道', 's113213065@ncnu.edu.tw'),
  ('113213055', '賴承妍', 's113213055@ncnu.edu.tw'),
  ('112213057', '趙麗珊', 's112213057@ncnu.edu.tw'),
  ('113213014', '邱郁傑', 's113213014@ncnu.edu.tw'),
  ('113213004', '郭佳瑜', 's113213004@ncnu.edu.tw'),
  ('113213045', '鄧俞明', 's113213045@ncnu.edu.tw'),
  ('113213062', '鄭丞鈞', 's113213062@ncnu.edu.tw'),
  ('113213022', '鄭禹岑', 's113213022@ncnu.edu.tw'),
  ('113213016', '鍾頌恩', 's113213016@ncnu.edu.tw'),
  ('113251001', '陳荃', 's113251001@ncnu.edu.tw'),
  ('113213038', '陳傳盛', 's113213038@ncnu.edu.tw'),
  ('112213058', '陳圓', 's112213058@ncnu.edu.tw'),
  ('113213035', '陳奕凱', 's113213035@ncnu.edu.tw'),
  ('113213020', '陳孝齊', 's113213020@ncnu.edu.tw'),
  ('113213025', '陳宥孝', 's113213025@ncnu.edu.tw'),
  ('113213083', '陳宥蓉', 's113213083@ncnu.edu.tw'),
  ('11408', '陳建宏', 'jhchen@ncnu.edu.tw'),
  ('113213021', '陳昱維', 's113213021@ncnu.edu.tw'),
  ('113213030', '陳瑋廷', 's113213030@ncnu.edu.tw'),
  ('113213011', '陳芃叡', 's113213011@ncnu.edu.tw'),
  ('113213037', '陳芝妮', 's113213037@ncnu.edu.tw'),
  ('113213074', '陳龍華', 's113213074@ncnu.edu.tw'),
  ('114213517', '韓育欣', 's114213517@ncnu.edu.tw'),
  ('113213010', '馮懷立', 's113213010@ncnu.edu.tw'),
  ('113213060', '黃映璇', 's113213060@ncnu.edu.tw'),
  ('112213013', '黃晟銘', 's112213013@ncnu.edu.tw'),
  ('113213031', '黃科竤', 's113213031@ncnu.edu.tw')
ON CONFLICT (student_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email;

-- 清除所有二字姓名中的全形與半形空格
UPDATE course_members SET name = REPLACE(REPLACE(name, '　', ''), ' ', '') WHERE name LIKE '%　%' OR name LIKE '% %';

ALTER TABLE course_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can verify course members" ON course_members;
CREATE POLICY "Anyone can verify course members"
  ON course_members FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can update course members" ON course_members;
CREATE POLICY "Anyone can update course members"
  ON course_members FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 課程教材內容儲存資料表 (提供管理員模式直接於雲端修改教材)
CREATE TABLE IF NOT EXISTS course_content (
  id VARCHAR(40) PRIMARY KEY,
  stages JSONB NOT NULL,
  lessons JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE course_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read course content" ON course_content;
CREATE POLICY "Anyone can read course content"
  ON course_content FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert or update course content" ON course_content;
CREATE POLICY "Anyone can insert or update course content"
  ON course_content FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);


