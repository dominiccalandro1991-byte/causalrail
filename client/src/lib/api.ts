import { buildDemoDashboard, findDemoRun } from "./demo-data";
import type { DashboardPayload } from "./types";

const API = (
  (import.meta.env.VITE_API_URL as string | undefined) ||
  "https://causalrail-api.onrender.com"
).replace(/\/$/, "");

export async function fetchDashboard(): Promise<DashboardPayload & { live?: boolean }> {
  try {
    const res = await fetch(`${API}/api/dashboard?user=demo`);
    if (!res.ok) return { ...buildDemoDashboard(), live: false };
    const json = (await res.json()) as DashboardPayload & { live?: boolean; kpis?: unknown };
    if (!json.kpis || !Array.isArray(json.runs)) return { ...buildDemoDashboard(), live: false };
    return { ...json, live: true };
  } catch {
    return { ...buildDemoDashboard(), live: false };
  }
}

export async function fetchRun(id: string) {
  try {
    const res = await fetch(`${API}/api/runs/${id}?user=demo`);
    if (!res.ok) return findDemoRun(id);
    return (await res.json()) as ReturnType<typeof findDemoRun>;
  } catch {
    return findDemoRun(id);
  }
}
