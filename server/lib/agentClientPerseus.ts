import fs from 'fs';
/**
 * Gemini Managed Agents client.
 * The server only sends user prompts — no inline system instructions.
 */

/* ────────────────────────────────────────────────────────── */
/*  Types                                                      */
/* ────────────────────────────────────────────────────────── */

export interface InteractionOptions {
  prompt: string;
  agentName?: string;
  environmentId?: string;
  previousInteractionId?: string;
  stream?: boolean;
  inlineSources?: Array<{
    type: string;
    content: string;
    target: string;
  }>;
  tools?: Array<{
    type: string;
    [key: string]: any;
  }>;
  signal?: AbortSignal;
}

export interface AgentEvent {
  type:
    | "thinking"
    | "text"
    | "tool_call"
    | "tool_result"
    | "complete"
    | "error"
    | "done";
  text?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  callId?: string;
  result?: string;
  interaction?: Record<string, unknown>;
  message?: string;
}

/* ────────────────────────────────────────────────────────── */
/*  Create an interaction                                       */
/* ────────────────────────────────────────────────────────── */
export const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export async function createInteraction(
  opts: InteractionOptions
): Promise<Response> {
  const agentName = "antigravity-preview-05-2026";

  const payload: Record<string, unknown> = {
    agent: agentName,
    agent_config: {
      type: "antigravity",
      model: "gemini-3.6-flash"
    },
    input: [
      {
        type: "text",
        text: opts.prompt,
      },
    ],
    stream: true,
  };

  if (opts.tools && opts.tools.length > 0) {
    payload.tools = opts.tools;
  }

  // Environment config
  if (opts.environmentId) {
    payload.environment = { env_id: opts.environmentId };
  } else {
    const envConfig: Record<string, unknown> = {
      type: "remote",
      sources: opts.inlineSources ?? [],
      network: {
        allowlist: [
          {
            domain: "generativelanguage.googleapis.com",
            transform: { "x-goog-api-key": process.env.GEMINI_API_KEY },
          },
          { domain: "query1.finance.yahoo.com" },
          { domain: "pypi.org" },
          { domain: "files.pythonhosted.org" },
          { domain: "oauth2.googleapis.com" },
          { domain: "gmail.googleapis.com" },
          { domain: "firestore.googleapis.com" },
          { domain: "*" },
        ],
      },
    };
    payload.environment = envConfig;
  }

  if (opts.previousInteractionId) {
    payload.previous_interaction_id = opts.previousInteractionId;
  }

  const response = await fetch(`${API_BASE_URL}/interactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
      "x-server-timeout": "600",
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });

  return response;
}

/* ────────────────────────────────────────────────────────── */
/*  Parse SSE stream                                            */
/* ────────────────────────────────────────────────────────── */

/**
 * Async generator that yields parsed AgentEvent objects from
 * the Gemini Managed Agents SSE stream.
 */
export async function* streamInteraction(
  response: Response
): AsyncGenerator<AgentEvent> {
  console.log(`[streamInteraction] Initializing stream reader on body present: ${!!response.body}`);
  const reader = response.body?.getReader();
  if (!reader) {
    console.error(`[streamInteraction] Error: response.body.getReader() is undefined!`);
    yield { type: "error", message: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let chunkCount = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      chunkCount++;
      const decoded = decoder.decode(value, { stream: true });
      buffer += decoded;

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (!trimmed.startsWith("data: ")) {
          continue;
        }

        const dataStr = trimmed.slice(6); // Strip "data: " prefix
        if (dataStr === "[DONE]") {
          yield { type: "done" };
          return;
        }

        try {
          const data = JSON.parse(dataStr);
          const event = parseAgentEvent(data);
          if (event) {
            yield event;
          }
        } catch (jsonErr: any) {
          console.error(`[streamInteraction] JSON Parse Error on payload:`, jsonErr.message);
          // Malformed JSON line — skip
          continue;
        }
      }
    }
  } catch (err: any) {
    console.error(`[streamInteraction] Exception caught in read loop:`, err);
    yield { type: "error", message: `Stream read exception: ${err.message}` };
  } finally {
    reader.releaseLock();
  }
}

/* ────────────────────────────────────────────────────────── */
/*  Parse a single raw SSE event into a frontend-friendly fmt  */
/* ────────────────────────────────────────────────────────── */

let syntheticCallIdCounter = 0;
function parseAgentEvent(
  event: Record<string, unknown>
): AgentEvent | null {
  const eventType = event.event_type as string | undefined;

  if (eventType === "step.delta") {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) return null;

    // 1. Tool Call results (function results, code execution output etc.)
    const resultVal = delta.result !== undefined ? delta.result : delta.response;
    if (resultVal !== undefined && resultVal !== null) {
      let resultStr = "";
      if (typeof resultVal === "object") {
        if (Array.isArray(resultVal) && resultVal.length > 0 && typeof resultVal[0]?.text === "string") {
          resultStr = resultVal.map((v: any) => v?.text || "").join("");
        } else {
          resultStr = JSON.stringify(resultVal);
        }
      } else {
        resultStr = String(resultVal);
      }
      const callId = (delta.call_id as string | undefined) || ((delta.call as any)?.id as string | undefined) || (delta.id as string | undefined) || `synth_${syntheticCallIdCounter}`;
      fs.appendFileSync('debug_delta.log', 'TOOL RESULT DELTA: ' + JSON.stringify(delta) + '\n');
      return {
        type: "tool_result",
        name: delta.name as string | undefined,
        result: resultStr,
        callId: callId,
      };
    }

    // 2. Tool Calls (function calls, code execution triggers etc.)
    const argumentsObj = (delta.arguments as Record<string, unknown> | undefined) || 
                         ((delta.call as any)?.arguments as Record<string, unknown> | undefined);
    const callName = (delta.name as string | undefined) || 
                     ((delta.call as any)?.name as string | undefined) || 
                     (delta.type === "code_execution_call" ? "code_execution_call" : undefined);

    if (callName || argumentsObj) {
      fs.appendFileSync('debug_delta.log', 'TOOL CALL DELTA: ' + JSON.stringify(delta) + '\n');
      syntheticCallIdCounter++;
      const callId = (delta.call_id as string | undefined) || ((delta.call as any)?.id as string | undefined) || (delta.id as string | undefined) || `synth_${syntheticCallIdCounter}`;
      return {
        type: "tool_call",
        name: callName || "code_execution_call",
        arguments: argumentsObj ?? {},
        callId: callId,
      };
    }

    // 3. Text & Reasoning / Thinking deltas (content modalities)
    let extractedText = "";
    let isThinking = false;

    // Check if the step delta is annotated as a thought/reasoning step
    if (
      delta.type === "thought_summary" || 
      delta.type === "thinking" || 
      delta.type === "thought" || 
      delta.type === "thought_delta"
    ) {
      isThinking = true;
    }

    if (typeof delta.text === "string") {
      extractedText = delta.text;
    } else if (typeof delta.thought === "string") {
      extractedText = delta.thought;
      isThinking = true;
    } else if (typeof delta.summary === "string" && isThinking) {
      extractedText = delta.summary;
    }

    // Parse the content modalities representation: "content" represents modalities only
    const content = delta.content;
    if (content !== undefined && content !== null) {
      if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === "object") {
            const partObj = part as Record<string, unknown>;
            if (partObj.type === "thought") {
              isThinking = true;
              if (typeof partObj.text === "string") {
                extractedText += partObj.text;
              } else if (typeof partObj.thought === "string") {
                extractedText += partObj.thought;
              }
            } else if (partObj.type === "text" && typeof partObj.text === "string") {
              extractedText += partObj.text;
            } else if (typeof partObj.text === "string") {
              extractedText += partObj.text;
            } else if (typeof partObj.thought === "string") {
              extractedText += partObj.thought;
              isThinking = true;
            }
          } else if (typeof part === "string") {
            extractedText += part;
          }
        }
      } else if (typeof content === "object") {
        const cObj = content as Record<string, unknown>;
        if (cObj.type === "thought") {
          isThinking = true;
          if (typeof cObj.text === "string") {
            extractedText = cObj.text;
          } else if (typeof cObj.thought === "string") {
            extractedText = cObj.thought;
          }
        } else if (cObj.type === "text" && typeof cObj.text === "string") {
          extractedText = cObj.text;
        } else if (typeof cObj.text === "string") {
          extractedText = cObj.text;
        } else if (typeof cObj.thought === "string") {
          extractedText = cObj.thought;
          isThinking = true;
        }
      } else if (typeof content === "string") {
        extractedText = content;
      }
    }

    if (extractedText) {
      return {
        type: isThinking ? "thinking" : "text",
        text: extractedText,
      };
    }
  }

  // Interaction complete
  if (eventType === "interaction.completed") {
    return {
      type: "complete",
      interaction: (event.interaction as Record<string, unknown>) ?? {},
    };
  }

  if (eventType === "error") {
    const errorObj = event.error as Record<string, unknown> | undefined;
    return {
      type: "error",
      message: errorObj?.message ? String(errorObj.message) : "An error occurred with the AI agent execution.",
    };
  }

  // Gracefully ignore expected control or framing events that don't need UI representation
  const expectedControlEvents = [
    "interaction.created",
    "interaction.status_update",
    "step.start",
    "step.stop",
    "step.delta",
  ];
  if (eventType && expectedControlEvents.includes(eventType)) {
    return null;
  }

  console.log(`[parseAgentEvent] Diagnostic: Unhandled event_type="${eventType}":`, JSON.stringify(event).substring(0, 300));
  return null;
}
