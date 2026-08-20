import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDashboard } from "../lib/api";
import type { DashboardPayload } from "../lib/types";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function Dashboard() {
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    void fetchDashboard().then(setData);
  }, []);

  if (!data) {
    return <div className="px-6 py-16 text-muted">Loading rail…</div>;
  }

  const lookup = new Map(data.matrix.cells.map((c) => [`${c.workflow}|${c.day}`, c]));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-subtle">Demo rail</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Failure attribution
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">
          Deterministic stack fingerprints. Counterfactual reruns. Compute you stop lighting on fire.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
        {[
          ["Failures attributed", String(data.kpis.openFailures), `${Math.round(data.kpis.attributionRate * 100)}% fingerprinted`],
          ["Flaky signatures", String(data.kpis.flakySignatures), "mixed pass / fail"],
          ["Compute saved", usd(data.kpis.computeSavedUsd), `of ${usd(data.kpis.computeSpentUsd)} spent`],
          ["Runs analyzed", String(data.kpis.runsAnalyzed), "last 14 days"],
        ].map(([label, value, hint]) => (
          <article key={label} className="bg-surface px-4 py-4 sm:px-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums leading-none">{value}</p>
            <p className="mt-2 text-sm text-muted">{hint}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="font-display text-xl font-semibold">Failure matrix</h2>
        <p className="mt-1 text-sm text-muted">Workflow by day. Intensity is failure count.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-28 text-left font-mono text-[10px] uppercase text-subtle">Workflow</th>
                {data.matrix.days.map((day) => (
                  <th key={day} className="font-mono text-[10px] text-subtle">
                    {day.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.matrix.workflows.map((wf) => (
                <tr key={wf}>
                  <td className="pr-2 font-mono text-xs text-muted">{wf}</td>
                  {data.matrix.days.map((day) => {
                    const cell = lookup.get(`${wf}|${day}`);
                    const fails = cell?.failures ?? 0;
                    const flakes = cell?.flakes ?? 0;
                    const tone =
                      fails === 0
                        ? "bg-raised"
                        : flakes > 0
                          ? "bg-warn"
                          : fails >= 2
                            ? "bg-signal"
                            : "bg-signal/60";
                    return (
                      <td key={day}>
                        <div className={`mx-auto h-7 w-full max-w-8 rounded-sm ${tone}`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5 lg:col-span-3">
          <h2 className="font-display text-xl font-semibold">Compute cost</h2>
          <div className="mt-4 h-48 text-muted">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.savingsSeries.map((p) => ({ ...p, label: p.day.slice(5) }))}>
                <XAxis dataKey="label" tick={{ fill: "currentColor", fontSize: 11 }} stroke="rgba(236,232,224,0.16)" />
                <YAxis tick={{ fill: "currentColor", fontSize: 11 }} stroke="rgba(236,232,224,0.16)" width={40} />
                <Tooltip
                  contentStyle={{ background: "#151514", border: "1px solid rgba(236,232,224,0.12)", fontSize: 12 }}
                  formatter={(value, name) => [usd(Number(value)), name === "saved" ? "Saved" : "Spent"]}
                />
                <Area type="monotone" dataKey="spent" stroke="#8a867c" fill="#8a867c" fillOpacity={0.12} />
                <Area type="monotone" dataKey="saved" stroke="#6f8f72" fill="#6f8f72" fillOpacity={0.22} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-surface lg:col-span-2">
          <header className="border-b border-border px-5 py-3">
            <h2 className="font-display text-xl font-semibold">Flaky signatures</h2>
          </header>
          <ul className="divide-y divide-border">
            {data.flakes.map((f) => (
              <li key={f.fingerprint} className="px-5 py-3">
                <p className="font-mono text-xs text-muted">{f.fingerprint.slice(0, 12)}</p>
                <p className="mt-1 text-sm">{f.signature}</p>
                <p className="mt-1 font-mono text-[11px] text-subtle">
                  {f.failCount} fail · {f.passCount} pass
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-border bg-surface">
        <header className="border-b border-border px-5 py-3">
          <h2 className="font-display text-xl font-semibold">Recent runs</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="font-mono text-[10px] uppercase text-subtle">
              <tr className="border-b border-border">
                <th className="px-5 py-2 font-medium">Repo</th>
                <th className="px-2 py-2 font-medium">Workflow</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Cause</th>
              </tr>
            </thead>
            <tbody>
              {data.runs.map((run) => {
                const analysis = data.analyses.find((a) => a.build_run_id === run.id);
                return (
                  <tr key={run.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{run.repo.split("/")[1]}</td>
                    <td className="px-2 py-3">{run.workflow_name}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[11px] uppercase ${
                          run.status === "failure"
                            ? run.is_flaky
                              ? "bg-warn/15 text-warn"
                              : "bg-signal/15 text-signal"
                            : "bg-ok/15 text-ok"
                        }`}
                      >
                        {run.is_flaky && run.status === "failure" ? "flake" : run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link to={`/inspect/${run.id}`} className="text-fg underline-offset-4 hover:underline">
                        {analysis?.root_cause ?? (run.status === "success" ? "Clean run" : "Inspect")}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
