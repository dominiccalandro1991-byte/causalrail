import { Octokit } from "@octokit/rest";
import { config } from "../config.js";

export type DispatchInput = {
  owner: string;
  repo: string;
  workflow: string;
  ref: string;
  fingerprint: string;
  parentRunId: string;
};

export async function dispatchCounterfactualRerun(input: DispatchInput): Promise<{
  ok: boolean;
  status: number;
  message: string;
}> {
  if (!config.githubToken) {
    return { ok: false, status: 0, message: "GITHUB_TOKEN is not configured." };
  }

  const octokit = new Octokit({ auth: config.githubToken });
  try {
    await octokit.actions.createWorkflowDispatch({
      owner: input.owner,
      repo: input.repo,
      workflow_id: input.workflow,
      ref: input.ref,
      inputs: {
        causalrail_fingerprint: input.fingerprint,
        causalrail_parent_run: input.parentRunId,
        causalrail_mode: "counterfactual",
      },
    });
    return { ok: true, status: 204, message: "workflow_dispatch accepted." };
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : "dispatch failed";
    return { ok: false, status, message };
  }
}

export function splitRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split("/");
  return { owner: owner || "", repo: repo || fullName };
}
