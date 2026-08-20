import type { QueryResultRow } from "pg";

type RunStatus = "success" | "failure" | "cancelled" | "in_progress";
type FailureCategory =
  | "assertion"
  | "timeout"
  | "flake"
  | "infra"
  | "dependency"
  | "oom"
  | "unknown";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v) || 0;
  return 0;
}

function iso(v: unknown): string {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapRun(row: QueryResultRow) {
  return {
    id: String(row.id),
    repo: String(row.repo),
    workflow_name: String(row.workflow_name),
    job_name: row.job_name == null ? null : String(row.job_name),
    branch: row.branch == null ? null : String(row.branch),
    sha: row.sha == null ? null : String(row.sha),
    status: String(row.status) as RunStatus,
    completed_at: iso(row.completed_at ?? row.created_at),
    created_at: iso(row.created_at),
    duration_ms: num(row.duration_ms),
    compute_cost_usd: num(row.compute_cost_usd),
    saved_cost_usd: num(row.saved_cost_usd),
    fingerprint: row.fingerprint == null ? null : String(row.fingerprint),
    raw_log: row.raw_log == null ? null : String(row.raw_log),
    normalized_trace: row.normalized_trace == null ? null : String(row.normalized_trace),
    is_flaky: row.is_flaky === true || row.is_flaky === "t",
  };
}

function mapAnalysis(row: QueryResultRow) {
  return {
    id: String(row.id),
    build_run_id: String(row.build_run_id),
    fingerprint: String(row.fingerprint),
    root_cause: row.root_cause == null ? null : String(row.root_cause),
    category: String(row.category) as FailureCategory,
    confidence: num(row.confidence),
    llm_used: row.llm_used === true || row.llm_used === "t",
  };
}

function days14(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function assembleDashboard(userId: string, runRows: QueryResultRow[], analysisRows: QueryResultRow[]) {
  const runs = runRows.map(mapRun);
  const analyses = analysisRows.map(mapAnalysis);
  const days = days14();
  const workflows = Array.from(new Set(runs.map((r) => r.workflow_name))).sort();
  const cells = workflows.flatMap((workflow) =>
    days.map((day) => {
      const inCell = runs.filter(
        (r) => r.workflow_name === workflow && r.completed_at.slice(0, 10) === day,
      );
      return {
        workflow,
        day,
        failures: inCell.filter((r) => r.status === "failure").length,
        flakes: inCell.filter((r) => r.status === "failure" && r.is_flaky).length,
        passes: inCell.filter((r) => r.status === "success").length,
      };
    }),
  );

  const flakeMap = new Map<
    string,
    {
      fingerprint: string;
      signature: string;
      repo: string;
      workflow_name: string;
      category: FailureCategory;
      count: number;
      failCount: number;
      passCount: number;
    }
  >();
  for (const run of runs.filter((r) => r.is_flaky && r.fingerprint)) {
    const cur = flakeMap.get(run.fingerprint!) ?? {
      fingerprint: run.fingerprint!,
      signature: run.normalized_trace ?? run.job_name ?? run.workflow_name,
      repo: run.repo,
      workflow_name: run.workflow_name,
      category: (analyses.find((a) => a.fingerprint === run.fingerprint)?.category ??
        "flake") as FailureCategory,
      count: 0,
      failCount: 0,
      passCount: 0,
    };
    cur.count += 1;
    if (run.status === "failure") cur.failCount += 1;
    else cur.passCount += 1;
    flakeMap.set(run.fingerprint!, cur);
  }

  const failures = runs.filter((r) => r.status === "failure");
  const attributed = failures.filter((r) => r.fingerprint).length;

  return {
    workspace: userId === "demo" ? "demo" : "personal",
    live: true,
    kpis: {
      openFailures: failures.length,
      flakySignatures: flakeMap.size,
      computeSavedUsd: runs.reduce((s, r) => s + r.saved_cost_usd, 0),
      computeSpentUsd: runs.reduce((s, r) => s + r.compute_cost_usd, 0),
      attributionRate: failures.length ? attributed / failures.length : 1,
      runsAnalyzed: runs.length,
    },
    matrix: { workflows, days, cells },
    runs: runs.slice(0, 40),
    flakes: Array.from(flakeMap.values()),
    savingsSeries: days.map((day) => ({
      day,
      saved: runs
        .filter((r) => r.completed_at.slice(0, 10) === day)
        .reduce((s, r) => s + r.saved_cost_usd, 0),
      spent: runs
        .filter((r) => r.completed_at.slice(0, 10) === day)
        .reduce((s, r) => s + r.compute_cost_usd, 0),
    })),
    analyses,
  };
}
