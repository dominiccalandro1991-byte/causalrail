/** HTTP client to IncidentDojo. Never throws. Does not touch the normalizer. */

import { config } from "../config.js";

function baseUrl(): string {
  const raw = (config.incidentDojoUrl ?? "").trim().replace(/\/$/, "");
  if (!raw || /postgres|supabase\.com/i.test(raw)) return "";
  if (!raw.startsWith("https://") && !raw.startsWith("http://localhost")) return "";
  return raw;
}

async function postJson(path: string, body: unknown): Promise<unknown | null> {
  const root = baseUrl();
  if (!root) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${root}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

export async function queryHistoricalPatch(errorStack: string): Promise<{
  hit: boolean;
  patch_diff?: string;
  distance?: number;
  incident_id?: string;
  proofpatch_commit_sha?: string;
} | null> {
  const json = (await postJson("/incidentdojo/query", { error_stack: errorStack, threshold: 0.05 })) as {
    hit?: boolean;
    patch_diff?: string;
    distance?: number;
    incident_id?: string;
    proofpatch_commit_sha?: string;
  } | null;
  return json;
}

export async function ingestFailure(opts: {
  runId: string;
  fingerprint: string;
  rawLog: string;
  repo?: string;
  workflow?: string;
}): Promise<void> {
  await postJson("/incidentdojo/ingest-failure", {
    error_stack: opts.rawLog,
    causalrail_trace_id: opts.runId,
    fingerprint: opts.fingerprint,
    repo: opts.repo,
    workflow: opts.workflow,
  });
}
