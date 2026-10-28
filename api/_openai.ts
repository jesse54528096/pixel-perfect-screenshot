// Thin wrapper around the two OpenAI endpoints M4 uses. Server-only: it reads
// OPENAI_API_KEY, so it must never be imported from src/ (the browser bundle).
const API = "https://api.openai.com/v1";

// Must match the vector(1536) column in style_refs. Changing it means re-embedding everything.
export const EMBED_MODEL = "text-embedding-3-small";

function apiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Missing OPENAI_API_KEY.");
  return key;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Log the detail server-side; callers only see a generic message.
    throw new Error(`OpenAI ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// Text → vectors, in the same order as the input.
export async function embed(texts: string[]): Promise<number[][]> {
  const out = await post<{ data: { index: number; embedding: number[] }[] }>("/embeddings", {
    model: EMBED_MODEL,
    input: texts,
  });
  return [...out.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export type UserContent =
  | string
  | (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }
    )[];

// One chat call whose reply must match `schema` (Structured Outputs, strict mode).
export async function chatJson<T>(opts: {
  system: string;
  user: UserContent;
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error("Missing OPENAI_MODEL.");
  const out = await post<{
    choices: { message: { content: string | null; refusal?: string | null } }[];
  }>("/chat/completions", {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
    },
  });
  const message = out.choices[0]?.message;
  if (!message?.content)
    throw new Error(`Model returned no content: ${message?.refusal ?? "empty"}`);
  return JSON.parse(message.content) as T;
}
