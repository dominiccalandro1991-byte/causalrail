import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { fetchRun } from "../lib/api";
import type { BuildRun, FailureAnalysis } from "../lib/types";

export function Inspector() {
  const { id } = useParams();
  const [state, setState] = useState<{
    run: BuildRun | null;
    analysis: FailureAnalysis | null;
    siblings: BuildRun[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetchRun(id).then(setState);
  }, [id]);

  if (!state) return <div className="px-6 py-16 text-muted">Loading trace…</div>;
  if (!state.run) {
    return (
      <div className="px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">Run not on this rail</h1>
        <Link to="/" className="mt-4 inline-block text-sm underline-offset-4 hover:underline">
          Back to board
        </Link>
      </div>
    );
  }

  const { run, analysis, siblings } = state;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="border-b border-border px-4 py-2 sm:px-6">
        <Link to="/" className="font-mono text-[11px] text-muted no-underline hover:text-fg">
          ← Board
        </Link>
      </div>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">Trace inspector</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {run.repo} · {run.workflow_name}
          </h1>
          <p className="mt-1 font-mono text-xs text-muted">
            {run.job_name} · {run.branch} · {run.sha?.slice(0, 7)}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] uppercase ${
            run.status === "failure"
              ? run.is_flaky
                ? "bg-warn/15 text-warn"
                : "bg-signal/15 text-signal"
              : "bg-ok/15 text-ok"
          }`}
        >
          {run.is_flaky ? "flake" : run.status}
        </span>
      </header>
      <div className="grid gap-px border-b border-border bg-border lg:grid-cols-3">
        <Meta label="Fingerprint" value={run.fingerprint?.slice(0, 12) ?? "unattributed"} />
        <Meta label="Root cause" value={analysis?.root_cause ?? "Unattributed"} />
        <Meta
          label="Confidence"
          value={analysis ? `${Math.round(analysis.confidence * 100)}%${analysis.llm_used ? " · LLM" : " · regex"}` : "—"}
        />
      </div>
      <PanelGroup direction="horizontal" className="min-h-[28rem] flex-1">
        <Panel defaultSize={50} minSize={30} className="bg-inset">
          <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
            Raw log
          </div>
          <pre className="h-[calc(100%-2.5rem)] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
            {run.raw_log || "No log captured for this run."}
          </pre>
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-accent/40" />
        <Panel defaultSize={50} minSize={30} className="bg-surface">
          <div className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">
            Normalized fingerprint
          </div>
          <pre className="h-[calc(100%-2.5rem)] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-accent">
            {run.fingerprint ? `# ${run.fingerprint}\n\n` : ""}
            {run.normalized_trace || "No frames extracted."}
          </pre>
        </Panel>
      </PanelGroup>
      {siblings.length > 1 ? (
        <section className="border-t border-border px-4 py-4 sm:px-6">
          <h2 className="font-display text-lg font-semibold">Same fingerprint</h2>
          <ul className="mt-2 divide-y divide-border">
            {siblings.map((s) => (
              <li key={s.id} className="flex justify-between py-2 text-sm">
                <span className="font-mono text-xs text-muted">{s.created_at.slice(0, 16).replace("T", " ")}</span>
                <span className="font-mono text-[11px] uppercase text-muted">{s.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3 sm:px-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
