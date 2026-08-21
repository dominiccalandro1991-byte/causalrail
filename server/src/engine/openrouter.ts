import type { FailureCategory } from "./types.js";
import { config } from "../config.js";

export type LlmParseResult = {
  category: FailureCategory;
  rootCause: string;
  confidence: number;
};

const SYSTEM = `You attribute CI failures. Reply with JSON only:
{"category":"assertion|timeout|flake|infra|dependency|oom|unknown","rootCause":"one sentence","confidence":0.0}
No markdown.`;

export async function parseLogWithOpenRouter(rawLog: string): Promise<LlmParseResult | null> {
  const harbor = (process.env.KEYHARBOR_URL ?? "").replace(/\/$/, "");
  const harborToken = (process.env.KEYHARBOR_TOKEN ?? "").trim();
  const useHarbor = harbor.startsWith("https://") && !!harborToken && !/postgres|supabase\.com/i.test(harbor);

  if (!useHarbor && !config.openRouterKey) return null;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url = "https://openrouter.ai/api/v1/chat/completions";
  if (useHarbor) {
    url = `${harbor}/v1/chat/completions`;
    headers.Authorization = `Bearer ${harborToken}`;
  } else {
    headers.Authorization = `Bearer ${config.openRouterKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.openRouterModel,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: rawLog.slice(0, 8000) },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      category?: string;
      rootCause?: string;
      confidence?: number;
    };
    const allowed: FailureCategory[] = [
      "assertion",
      "timeout",
      "flake",
      "infra",
      "dependency",
      "oom",
      "unknown",
    ];
    return {
      category: allowed.includes(parsed.category as FailureCategory)
        ? (parsed.category as FailureCategory)
        : "unknown",
      rootCause: String(parsed.rootCause ?? "LLM could not name a cause.").slice(0, 400),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    };
  } catch {
    return null;
  }
}
