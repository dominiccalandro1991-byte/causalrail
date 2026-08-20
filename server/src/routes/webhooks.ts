import type { Request, Response } from "express";
import { ingestRawLog } from "../engine/ingest.js";
import { config } from "../config.js";

export async function handleGitHubWebhook(req: Request, res: Response): Promise<void> {
  const event = req.header("x-github-event") ?? "";
  if (event === "ping") {
    res.json({ ok: true, pong: true });
    return;
  }
  if (event !== "workflow_run") {
    res.json({ ok: true, ignored: event });
    return;
  }

  const payload = req.body as {
    action?: string;
    workflow_run?: {
      id: number;
      name?: string;
      head_branch?: string;
      head_sha?: string;
      conclusion?: string | null;
      display_title?: string;
    };
    repository?: { full_name?: string };
    logs?: string;
  };

  const run = payload.workflow_run;
  if (!run || payload.action !== "completed" || run.conclusion !== "failure") {
    res.json({ ok: true, ignored: payload.action ?? run?.conclusion });
    return;
  }

  const log =
    payload.logs ??
    `GitHub workflow_run failure\n${run.display_title ?? run.name ?? "workflow"}\nconclusion=${run.conclusion}`;

  const ingested = await ingestRawLog({
    userId: config.webhookUser,
    repo: payload.repository?.full_name ?? "unknown/repo",
    workflow: run.name ?? "workflow",
    branch: run.head_branch,
    sha: run.head_sha,
    githubRunId: run.id,
    rawLog: log,
  });

  res.json({ ok: true, ...ingested });
}
