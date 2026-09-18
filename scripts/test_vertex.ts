import { GoogleGenAI } from '@google/genai'

process.loadEnvFile('.env')

console.log('Project ID:', process.env.GOOGLE_CLOUD_PROJECT_ID)
console.log('Credentials path:', process.env.GOOGLE_APPLICATION_CREDENTIALS)

const ai = new GoogleGenAI({
  vertexAI: true,
  project: process.env.GOOGLE_CLOUD_PROJECT_ID,
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
})

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello! Please reply with a short JSON string: {"message": "Vertex AI connected"}',
    })
    console.log('Success with gemini-2.5-flash:', response.text)
  } catch (err: any) {
    console.error('Error with gemini-2.5-flash:', err?.message || err)
    try {
      console.log('Testing gemini-2.0-flash...')
      const r2 = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: 'Hello! Please reply with a short JSON string: {"message": "Vertex AI connected"}',
      })
      console.log('Success with gemini-2.0-flash:', r2.text)
    } catch (e2: any) {
      console.error('Error with gemini-2.0-flash:', e2?.message || e2)
      try {
        console.log('Testing gemini-1.5-flash...')
        const r3 = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: 'Hello! Please reply with a short JSON string: {"message": "Vertex AI connected"}',
        })
        console.log('Success with gemini-1.5-flash:', r3.text)
      } catch (e3: any) {
        console.error('Error with gemini-1.5-flash:', e3?.message || e3)
      }
    }
  }
}

test()
