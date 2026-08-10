/**
 * Minimal OpenAI Responses API client, replacing the previous
 * @google/genai (Gemini) integration used for both translating imported
 * OpenTDB questions and generating in-game RPG questions. Mirrors the
 * same endpoint/response-parsing shape as EduQuest's own api/_openai.ts
 * helper (the two products share the same OpenAI account/key), kept as
 * its own small file since Terravox had no equivalent helper yet.
 */

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export class OpenAIError extends Error {}

/**
 * The Responses API puts the model's text inside output[].content[]; some
 * clients also expose the output_text shortcut. Accept either without
 * depending on an SDK at runtime.
 */
function extractResponseText(payload: any): string | null {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload?.output)) return null;
  const text = payload.output
    .flatMap((item: any) => (Array.isArray(item?.content) ? item.content : []))
    .filter((content: any) => content?.type === "output_text" && typeof content?.text === "string")
    .map((content: any) => content.text.trim())
    .filter(Boolean)
    .join("\n");
  return text || null;
}

export async function generateOpenAIText(instructions: string, input: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIError("OPENAI_API_KEY não está configurada neste ambiente.");

  let response: Response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, instructions, input, temperature: 0.4 }),
    });
  } catch (error) {
    throw new OpenAIError(`Não foi possível conectar à OpenAI: ${error instanceof Error ? error.message : String(error)}`);
  }

  const rawBody = await response.text();
  let payload: any;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new OpenAIError("A OpenAI retornou uma resposta em formato inesperado.");
  }

  if (!response.ok) {
    console.error("OpenAI error:", response.status, payload);
    throw new OpenAIError(`A OpenAI recusou a chamada (status ${response.status}).`);
  }

  const outputText = extractResponseText(payload);
  if (!outputText) throw new OpenAIError("A OpenAI respondeu, mas não devolveu conteúdo utilizável.");
  return outputText;
}

/** Strips a ```json ... ``` fence if the model added one despite being asked not to. */
export function parseJsonResponse(text: string): unknown {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(withoutFence);
}
