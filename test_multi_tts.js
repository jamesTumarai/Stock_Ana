import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-tts-preview',
      input: "Speaker 1: Hello. Speaker 2: Hi there. How are you? Speaker 1: Doing great.",
      response_modalities: ['audio'],
      generation_config: {
        speech_config: [
          {
            speaker: "Speaker 1",
            language: "en-us",
            voice: "kore"
          },
          {
            speaker: "Speaker 2",
            language: "en-us",
            voice: "aoede"
          }
        ]
      }
    });
    let audioBuffer = null;
    for (const step of interaction.steps) {
      if (step.type === 'model_output') {
        const audioContent = step.content?.find(c => c.type === 'audio');
        if (audioContent && audioContent.data) {
          audioBuffer = Buffer.from(audioContent.data, 'base64');
        }
      }
    }
    console.log("Success with multiple speakers array. Audio size:", audioBuffer?.length);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
