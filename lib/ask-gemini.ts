// Server-side Gemini adapter. Reuses the scoped prompt and answer schema; no
// search tools, URL context or conversation history are sent to Google.
import { AskProviderError, type AskCompletion, type AskDeps } from "./ask-llm.ts";

type Params = Parameters<AskDeps["complete"]>[0];
type Fetch = typeof fetch;
export const GEMINI_TIMEOUT_MS = 35_000;

export async function completeGemini(params: Params, key: string, fetcher: Fetch = fetch): Promise<AskCompletion> {
  // Keep the whole call inside the console's 40-second window. No retries:
  // a slow provider should fall back without spending another model request.
  try {
    const response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: params.system }] },
          contents: params.messages.map((message) => ({ role: "user", parts: [{ text: message.content }] })),
          generationConfig: {
            maxOutputTokens: params.max_tokens,
            responseMimeType: "application/json",
            responseJsonSchema: params.output_config?.format?.schema,
          },
        }),
      },
    );
    if (!response.ok) throw new AskProviderError("Gemini request failed");
    const data = await response.json() as {
      candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.filter((part) => !part.thought && typeof part.text === "string")
      .map((part) => part.text).join("") ?? "";
    return {
      stop_reason: candidate?.finishReason === "STOP" ? "end_turn" : "refusal",
      content: [{ type: "text", text }],
    };
  } catch {
    // Provider bodies and network errors can contain credentials. Keep them out
    // of logs and return through the shared, rate-limited offline fallback.
    throw new AskProviderError("Gemini request failed");
  }
}
