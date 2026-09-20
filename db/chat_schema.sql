-- ==============================================================================
-- WebCraft 聯絡我們與對話系統完整資料庫與 Storage 設定指令 (chat_schema.sql)
-- 請至 Supabase Dashboard -> SQL Editor 貼上並執行 (Run) 即可一鍵完成所有配置
-- ==============================================================================

-- ==============================================================================
-- 1. 聊天訊息資料表 (chat_messages)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  student_id VARCHAR(40) NOT NULL,
  student_name VARCHAR(80) NOT NULL,
  sender_role VARCHAR(20) NOT NULL DEFAULT 'student', -- 'student' | 'ta'
  content TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,                                 -- 單圖 URL 或多圖序列化 JSON 陣列
  attachment_name TEXT,                                -- 檔名或張數說明 (如 "3 張圖片")
  attachment_type VARCHAR(50),                         -- 'image/png', 'image/jpeg', 'image/gif' 或 'images'
  reply_to_id BIGINT REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  is_recalled BOOLEAN NOT NULL DEFAULT FALSE,
  likes INT NOT NULL DEFAULT 0,
  liked_by JSONB DEFAULT '[]'::jsonb,
  is_read_by_ta BOOLEAN NOT NULL DEFAULT FALSE,
  is_read_by_student BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引優化：查詢學生聊天紀錄與按時間排序
CREATE INDEX IF NOT EXISTS idx_chat_messages_student_id ON public.chat_messages (student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages (created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_ta ON public.chat_messages (is_read_by_ta) WHERE is_read_by_ta = FALSE;

-- ==============================================================================
-- 2. 學生對話安全密碼防護資料表 (student_chat_auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.student_chat_auth (
  student_id VARCHAR(40) PRIMARY KEY,
  student_name VARCHAR(80),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 3. 資料表 Row Level Security (RLS) 安全策略
-- ==============================================================================
-- (1) chat_messages 表
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can select chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can select chat messages"
  ON public.chat_messages FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can insert chat messages"
  ON public.chat_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update chat messages" ON public.chat_messages;
CREATE POLICY "Anyone can update chat messages"
  ON public.chat_messages FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- (2) student_chat_auth 表
ALTER TABLE public.student_chat_auth ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can select student chat auth" ON public.student_chat_auth;
CREATE POLICY "Anyone can select student chat auth"
  ON public.student_chat_auth FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert student chat auth" ON public.student_chat_auth;
CREATE POLICY "Anyone can insert student chat auth"
  ON public.student_chat_auth FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update student chat auth" ON public.student_chat_auth;
CREATE POLICY "Anyone can update student chat auth"
  ON public.student_chat_auth FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 4. Supabase Storage (Bucket: message_attach) 自動建立與權限配置
-- ==============================================================================
-- 建立或更新 message_attach 公開儲存庫 (限制 5MB，僅允許圖片)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message_attach',
  'message_attach',
  true,
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/gif'];

-- 啟用 storage.objects RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 允許任何人讀取/檢視/下載 message_attach 內之圖片
DROP POLICY IF EXISTS "Public Access message_attach" ON storage.objects;
CREATE POLICY "Public Access message_attach"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'message_attach');

-- 允許學生與助教上傳圖片附件至 message_attach
DROP POLICY IF EXISTS "Allow Upload to message_attach" ON storage.objects;
CREATE POLICY "Allow Upload to message_attach"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'message_attach');

-- 允許更新/覆蓋 message_attach 內之物件
DROP POLICY IF EXISTS "Allow Update on message_attach" ON storage.objects;
CREATE POLICY "Allow Update on message_attach"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'message_attach')
  WITH CHECK (bucket_id = 'message_attach');

-- 允許刪除 message_attach 內之物件
DROP POLICY IF EXISTS "Allow Delete on message_attach" ON storage.objects;
CREATE POLICY "Allow Delete on message_attach"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'message_attach');

-- ==============================================================================
-- 5. 即時推送 (Realtime) 廣播支援 (若專案已開啟 Realtime)
-- ==============================================================================
DO $$
BEGIN
  ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- 若環境未開啟 Realtime 則安全忽略，不中斷整體執行
  NULL;
END $$;
