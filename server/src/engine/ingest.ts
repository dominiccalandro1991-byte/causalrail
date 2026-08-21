import { query } from "../db.js";
import { normalizeStackTrace } from "./normalizer.js";
import { parseLogWithOpenRouter } from "./openrouter.js";
import { ingestFailure as incidentDojoIngest, queryHistoricalPatch } from "./incidentdojo.js";
import type { FailureCategory } from "./types.js";

export async function ingestRawLog(opts: {
  userId: string;
  repo: string;
  workflow: string;
  job?: string;
  branch?: string;
  sha?: string;
  rawLog: string;
  githubRunId?: number;
  rerunOf?: string | null;
}): Promise<{
  runId: string;
  fingerprint: string;
  category: FailureCategory;
  llmUsed: boolean;
  incidentDojoHit?: boolean;
  suggestedPatch?: string | null;
}> {
  let result = normalizeStackTrace(opts.rawLog);
  let llmUsed = false;
  let incidentDojoHit = false;
  let suggestedPatch: string | null = null;
  const recalled = await queryHistoricalPatch(opts.rawLog);
  if (recalled?.hit && recalled.patch_diff) {
    incidentDojoHit = true;
    suggestedPatch = recalled.patch_diff;
  }
  if (result.needsLlm && !incidentDojoHit) {
    const llm = await parseLogWithOpenRouter(opts.rawLog);
    if (llm) {
      llmUsed = true;
      result = { ...result, ...llm };
    }
  }

  const prior = await query<{ status: string }>(
    `select status from build_runs where user_id = $1 and fingerprint = $2`,
    [opts.userId, result.fingerprint],
  );
  const hadPass = prior.some((r) => r.status === "success");
  const hadFail = prior.some((r) => r.status === "failure");
  const isFlaky = hadPass;
  const saved = hadFail ? 0.0576 : 0;

  const inserted = await query<{ id: string }>(
    `insert into build_runs (
      user_id, github_run_id, repo, workflow_name, job_name, branch, sha,
      status, conclusion, started_at, completed_at, duration_ms,
      compute_cost_usd, saved_cost_usd, fingerprint, raw_log, normalized_trace,
      is_flaky, rerun_of
    ) values (
      $1,$2,$3,$4,$5,$6,$7,'failure','failure', now() - interval '3 minutes', now(),
      180000, 0.024, $8, $9, $10, $11, $12, $13
    ) returning id`,
    [
      opts.userId,
      opts.githubRunId ?? null,
      opts.repo,
      opts.workflow,
      opts.job ?? null,
      opts.branch ?? "main",
      opts.sha ?? null,
      saved,
      result.fingerprint,
      opts.rawLog,
      result.normalized,
      isFlaky || result.category === "flake",
      opts.rerunOf ?? null,
    ],
  );
  const runId = inserted[0]?.id;
  if (!runId) throw new Error("insert build_runs failed");

  await query(
    `insert into failure_analysis (
      user_id, build_run_id, fingerprint, root_cause, category, confidence, llm_used
    ) values ($1,$2,$3,$4,$5,$6,$7)`,
    [opts.userId, runId, result.fingerprint, result.rootCause, result.category, result.confidence, llmUsed],
  );

  if (isFlaky || result.category === "flake") {
    await query(
      `update build_runs set is_flaky = true where user_id = $1 and fingerprint = $2`,
      [opts.userId, result.fingerprint],
    );
  }

  void incidentDojoIngest({
    runId,
    fingerprint: result.fingerprint,
    rawLog: opts.rawLog,
    repo: opts.repo,
    workflow: opts.workflow,
  });

  return {
    runId,
    fingerprint: result.fingerprint,
    category: result.category,
    llmUsed,
    incidentDojoHit,
    suggestedPatch,
  };
}
