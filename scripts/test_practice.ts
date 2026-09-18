import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fappvrqhzfvurajqrmxy.supabase.co', 'sb_publishable_ofpM-sCewS83hO_WEh1E6g_5zR6MaFV');

async function main() {
  const { data, error } = await supabase.from('practice_submissions').select('*').limit(1);
  console.log('Sample row from practice_submissions:', data);
}
main();
