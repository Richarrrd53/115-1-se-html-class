import { aiQueue } from '../server/aiQueue'

async function run() {
  console.log('Testing aiQueue with incorrect code...')
  const test1 = await aiQueue.enqueue({
    lessonTitle: 'HTML 按鈕實作',
    instructions: '請在 HTML 中新增一個 class 為 btn-primary 的 button 元素，文字為「點我」',
    checklist: ['包含 <button> 元素', 'class 需為 btn-primary', '按鈕文字需包含「點我」'],
    starterCode: { html: '<div></div>', css: '', js: '' },
    answerCode: { html: '<button class="btn-primary">點我</button>', css: '', js: '' },
    studentCode: { html: '<div><p>這不是按鈕</p></div>', css: '', js: '' },
  })

  console.log('Test 1 result (Should fail):')
  console.log('- Passed:', test1.passed)
  console.log('- Score:', test1.score)
  console.log('- Errors count:', test1.errors.length, test1.errors)
  console.log('- Checklist:', test1.checklistStatus)

  console.log('\nTesting aiQueue with correct code...')
  const test2 = await aiQueue.enqueue({
    lessonTitle: 'HTML 按鈕實作',
    instructions: '請在 HTML 中新增一個 class 為 btn-primary 的 button 元素，文字為「點我」',
    checklist: ['包含 <button> 元素', 'class 需為 btn-primary', '按鈕文字需包含「點我」'],
    starterCode: { html: '<div></div>', css: '', js: '' },
    answerCode: { html: '<button class="btn-primary">點我</button>', css: '', js: '' },
    studentCode: { html: '<button class="btn-primary">點我</button>', css: '', js: '' },
  })

  console.log('Test 2 result (Should pass):')
  console.log('- Passed:', test2.passed)
  console.log('- Score:', test2.score)
  console.log('- Summary:', test2.summary)
}

run().catch(console.error)
