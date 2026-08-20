import { Router } from "express";
import { query } from "../db.js";
import { ingestRawLog } from "../engine/ingest.js";
import { dispatchCounterfactualRerun, splitRepo } from "../engine/rerun.js";
import { normalizeStackTrace } from "../engine/normalizer.js";

export const apiRouter = Router();

apiRouter.get("/dashboard", async (req, res) => {
  const userId = String(req.query.user ?? "demo");
  const runs = await query(`select * from build_runs where user_id = $1 order by created_at desc limit 80`, [userId]);
  const analyses = await query(
    `select * from failure_analysis where user_id = $1 order by created_at desc limit 80`,
    [userId],
  );
  res.json({ workspace: userId === "demo" ? "demo" : "personal", runs, analyses });
});

apiRouter.get("/runs/:id", async (req, res) => {
  const userId = String(req.query.user ?? "demo");
  const runs = await query(`select * from build_runs where id = $1 and user_id = $2 limit 1`, [
    req.params.id,
    userId,
  ]);
  const run = runs[0];
  if (!run) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const analyses = await query(
    `select * from failure_analysis where build_run_id = $1 and user_id = $2 limit 1`,
    [req.params.id, userId],
  );
  const siblings = run.fingerprint
    ? await query(
        `select * from build_runs where user_id = $1 and fingerprint = $2 order by created_at desc limit 8`,
        [userId, run.fingerprint],
      )
    : [];
  res.json({ run, analysis: analyses[0] ?? null, siblings });
});

apiRouter.post("/ingest", async (req, res) => {
  const body = req.body as {
    userId?: string;
    repo?: string;
    workflow?: string;
    rawLog?: string;
    job?: string;
    branch?: string;
    sha?: string;
  };
  if (!body.rawLog || !body.repo || !body.workflow) {
    res.status(400).json({ error: "repo, workflow, and rawLog are required" });
    return;
  }
  const ingested = await ingestRawLog({
    userId: body.userId ?? "demo",
    repo: body.repo,
    workflow: body.workflow,
    job: body.job,
    branch: body.branch,
    sha: body.sha,
    rawLog: body.rawLog,
  });
  res.json(ingested);
});

apiRouter.post("/normalize", (req, res) => {
  const rawLog = String((req.body as { rawLog?: string }).rawLog ?? "");
  res.json(normalizeStackTrace(rawLog));
});

apiRouter.post("/runs/:id/rerun", async (req, res) => {
  const userId = String((req.body as { userId?: string }).userId ?? "demo");
  const runs = await query<{
    id: string;
    repo: string;
    workflow_name: string;
    branch: string | null;
    fingerprint: string | null;
    raw_log: string | null;
    job_name: string | null;
    sha: string | null;
  }>(`select * from build_runs where id = $1 and user_id = $2 limit 1`, [req.params.id, userId]);
  const run = runs[0];
  if (!run?.fingerprint) {
    res.status(404).json({ error: "run not found or unattributed" });
    return;
  }
  const { owner, repo } = splitRepo(run.repo);
  const dispatched = await dispatchCounterfactualRerun({
    owner,
    repo,
    workflow: `${run.workflow_name}.yml`,
    ref: run.branch || "main",
    fingerprint: run.fingerprint,
    parentRunId: run.id,
  });
  const sibling = await ingestRawLog({
    userId,
    repo: run.repo,
    workflow: run.workflow_name,
    job: run.job_name ?? undefined,
    sha: run.sha ?? undefined,
    rawLog: run.raw_log || "counterfactual rerun — no log captured",
    rerunOf: run.id,
  });
  res.json({ ok: true, dispatched, sibling });
});
