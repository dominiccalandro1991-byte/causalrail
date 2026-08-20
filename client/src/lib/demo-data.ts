import type { BuildRun, DashboardPayload, FailureAnalysis, FailureCategory, RunStatus } from "./types";

const TAX = `FAIL  src/checkout/tax.test.ts
  AssertionError: expected 8.25 to be 8.5
    at Object.<anonymous> (src/checkout/tax.test.ts:48:21)`;

const RACE = `FAIL  tests/ledger.race.spec.ts
  expected 1, received 2 — intermittent / order-dependent
    at settleOnce (src/ledger/settle.ts:112:10)`;

const TIMEOUT = `TimeoutError: deadline exceeded after 30000ms
  File "src/pipeline/features.py", line 204, in materialize`;

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function fp(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}

function dayISO(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.toISOString();
}

function dateOnly(offset: number): string {
  return dayISO(offset).slice(0, 10);
}

export function buildDemoDashboard(): DashboardPayload {
  const workflows = ["unit", "integration", "e2e", "nightly", "image-build"];
  const days = Array.from({ length: 14 }, (_, i) => dateOnly(13 - i));
  const runs: BuildRun[] = [];
  const analyses: FailureAnalysis[] = [];
  let n = 1;

  const templates: {
    repo: string;
    workflow: string;
    job: string;
    failRate: number;
    flaky: boolean;
    log: string;
    category: FailureCategory;
    cause: string;
    norm: string;
  }[] = [
    {
      repo: "acme/web-checkout",
      workflow: "unit",
      job: "vitest",
      failRate: 0.2,
      flaky: false,
      log: TAX,
      category: "assertion",
      cause: "Hard assertion failed in product or test code.",
      norm: "at Object.<anonymous> (src/checkout/tax.test.ts:48)",
    },
    {
      repo: "acme/payments-api",
      workflow: "integration",
      job: "ledger",
      failRate: 0.45,
      flaky: true,
      log: RACE,
      category: "flake",
      cause: "Non-deterministic test observed.",
      norm: "at settleOnce (src/ledger/settle.ts:112)",
    },
    {
      repo: "acme/ml-batch",
      workflow: "nightly",
      job: "features",
      failRate: 0.15,
      flaky: false,
      log: TIMEOUT,
      category: "timeout",
      cause: "Operation exceeded its time budget.",
      norm: "at materialize (src/pipeline/features.py:204)",
    },
    {
      repo: "acme/web-checkout",
      workflow: "e2e",
      job: "playwright",
      failRate: 0.08,
      flaky: false,
      log: "npm ERR! code ECONNREFUSED\nnpm ERR! Failed to resolve registry.npmjs.org",
      category: "dependency",
      cause: "Upstream dependency or network resolution failed.",
      norm: "npm ECONNREFUSED registry.npmjs.org",
    },
    {
      repo: "acme/infra-terraform",
      workflow: "image-build",
      job: "docker",
      failRate: 0.05,
      flaky: false,
      log: "Cannot connect to the Docker daemon. no space left on device",
      category: "infra",
      cause: "Runner or infrastructure fault, not product code.",
      norm: "docker daemon / no space left",
    },
  ];

  for (let day = 13; day >= 0; day--) {
    for (const t of templates) {
      const salt = (day * 17 + t.workflow.length) % 10;
      const fail = t.flaky ? salt < 5 : salt < t.failRate * 10;
      const status: RunStatus = fail ? "failure" : "success";
      const runId = id(n++);
      const fingerprint = fp(t.norm);
      const spent = 0.024 + (day % 5) * 0.008;
      const saved = fail && day < 9 ? spent * 1.8 : 0;
      runs.push({
        id: runId,
        repo: t.repo,
        workflow_name: t.workflow,
        job_name: t.job,
        branch: "main",
        sha: fp(t.repo + day).slice(0, 40),
        status,
        completed_at: dayISO(day),
        created_at: dayISO(day),
        duration_ms: (3 + (day % 8)) * 60000,
        compute_cost_usd: Number(spent.toFixed(4)),
        saved_cost_usd: Number(saved.toFixed(4)),
        fingerprint,
        raw_log: fail ? t.log : null,
        normalized_trace: fail ? t.norm : null,
        is_flaky: t.flaky,
      });
      if (fail) {
        analyses.push({
          id: id(800 + n),
          build_run_id: runId,
          fingerprint,
          root_cause: t.cause,
          category: t.category,
          confidence: 0.82,
          llm_used: false,
        });
      }
    }
  }

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

  const flakeMap = new Map<string, DashboardPayload["flakes"][number]>();
  for (const run of runs.filter((r) => r.is_flaky && r.fingerprint)) {
    const cur = flakeMap.get(run.fingerprint!) ?? {
      fingerprint: run.fingerprint!,
      signature: run.normalized_trace ?? run.job_name ?? run.workflow_name,
      repo: run.repo,
      workflow_name: run.workflow_name,
      category: "flake" as FailureCategory,
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
  const computeSavedUsd = runs.reduce((s, r) => s + r.saved_cost_usd, 0);
  const computeSpentUsd = runs.reduce((s, r) => s + r.compute_cost_usd, 0);

  return {
    workspace: "demo",
    kpis: {
      openFailures: failures.length,
      flakySignatures: flakeMap.size,
      computeSavedUsd,
      computeSpentUsd,
      attributionRate: 1,
      runsAnalyzed: runs.length,
    },
    matrix: { workflows, days, cells },
    runs: [...runs].reverse().slice(0, 40),
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

export function findDemoRun(id: string) {
  const data = buildDemoDashboard();
  const run = data.runs.find((r) => r.id === id) ?? null;
  const analysis = data.analyses.find((a) => a.build_run_id === id) ?? null;
  const siblings = run?.fingerprint
    ? data.runs.filter((r) => r.fingerprint === run.fingerprint)
    : [];
  return { run, analysis, siblings };
}
