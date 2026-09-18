import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fappvrqhzfvurajqrmxy.supabase.co', 'sb_publishable_ofpM-sCewS83hO_WEh1E6g_5zR6MaFV');

async function main() {
  const testData = { test: true, time: new Date().toISOString() };
  const insertRes = await supabase.from('practice_submissions').insert({
    student_id: '__SYSTEM_COURSE_DATA__',
    student_name: 'COURSE_DATA',
    lesson_id: 'v1',
    code: JSON.stringify(testData)
  });
  console.log('Insert test result:', insertRes.error ? insertRes.error.message : 'SUCCESS');

  const { data, error } = await supabase
    .from('practice_submissions')
    .select('*')
    .eq('student_id', '__SYSTEM_COURSE_DATA__')
    .order('id', { ascending: false })
    .limit(1);

  console.log('Query test result:', error ? error.message : `Found ${data?.length} row(s)`, data?.[0]?.code);
}
main();
