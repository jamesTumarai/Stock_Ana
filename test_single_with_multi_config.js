import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-tts-preview',
      input: "This is just a normal sentence without speaker tags.",
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
    console.log("Success!");
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();
