import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
ai.interactions.create({
  model: 'gemini-3.1-flash-tts-preview',
  input: 'Hello',
  response_modalities: ['audio']
}).then(res => {
  const content = res.steps[0].content.find(c => c.type === 'audio');
  console.log(content.mime_type);
});
