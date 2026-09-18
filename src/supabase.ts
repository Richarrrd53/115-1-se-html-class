// src/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://fappvrqhzfvurajqrmxy.supabase.co'
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ofpM-sCewS83hO_WEh1E6g_5zR6MaFV'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)