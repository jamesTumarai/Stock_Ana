import "dotenv/config";
import { createInteraction, streamInteraction } from "./server/lib/agentClient.ts";
async function run() {
  const response = await createInteraction({ prompt: "Reply with 'Hi'" });
  for await (const event of streamInteraction(response)) {
    console.log(event);
  }
}
run();
