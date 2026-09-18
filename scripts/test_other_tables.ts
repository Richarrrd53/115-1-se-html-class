import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fappvrqhzfvurajqrmxy.supabase.co', 'sb_publishable_ofpM-sCewS83hO_WEh1E6g_5zR6MaFV');

async function main() {
  const tables = ['students', 'practice_sessions', 'courses', 'lessons', 'content', 'config', 'settings'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`Table ${t}:`, error ? `Error: ${error.message}` : `Success (${data?.length} rows)`);
  }
}
main();
