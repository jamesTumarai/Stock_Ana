import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
const ai = new GoogleGenAI({});
async function test() {
  const req = ai.interactions.create({
    agent: "antigravity-preview-05-2026",
    agentConfig: { type: "antigravity", model: "gemini-3.7-flash" },
    input: "Hello",
    config: { maxOutputTokens: 8192 }
  });
  console.log(JSON.stringify(req));
}
test().catch(console.error);
