export type RunStatus = "success" | "failure" | "cancelled" | "in_progress";
export type FailureCategory =
  | "assertion"
  | "timeout"
  | "flake"
  | "infra"
  | "dependency"
  | "oom"
  | "unknown";

export type BuildRun = {
  id: string;
  repo: string;
  workflow_name: string;
  job_name: string | null;
  branch: string | null;
  sha: string | null;
  status: RunStatus;
  completed_at: string;
  created_at: string;
  duration_ms: number;
  compute_cost_usd: number;
  saved_cost_usd: number;
  fingerprint: string | null;
  raw_log: string | null;
  normalized_trace: string | null;
  is_flaky: boolean;
};

export type FailureAnalysis = {
  id: string;
  build_run_id: string;
  fingerprint: string;
  root_cause: string | null;
  category: FailureCategory;
  confidence: number;
  llm_used: boolean;
};

export type DashboardPayload = {
  workspace: "demo" | "personal";
  live?: boolean;
  kpis: {
    openFailures: number;
    flakySignatures: number;
    computeSavedUsd: number;
    computeSpentUsd: number;
    attributionRate: number;
    runsAnalyzed: number;
  };
  matrix: {
    workflows: string[];
    days: string[];
    cells: { workflow: string; day: string; failures: number; flakes: number; passes: number }[];
  };
  runs: BuildRun[];
  flakes: {
    fingerprint: string;
    signature: string;
    repo: string;
    workflow_name: string;
    category: FailureCategory;
    count: number;
    failCount: number;
    passCount: number;
  }[];
  savingsSeries: { day: string; saved: number; spent: number }[];
  analyses: FailureAnalysis[];
};
