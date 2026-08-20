import { buildDemoDashboard, findDemoRun } from "./demo-data";
import type { DashboardPayload } from "./types";

const API = import.meta.env.VITE_API_URL as string | undefined;

export async function fetchDashboard(): Promise<DashboardPayload> {
  if (!API) return buildDemoDashboard();
  try {
    const res = await fetch(`${API}/api/dashboard`);
    if (!res.ok) return buildDemoDashboard();
    const json = (await res.json()) as { runs?: unknown };
    if (!json.runs) return buildDemoDashboard();
    return buildDemoDashboard();
  } catch {
    return buildDemoDashboard();
  }
}

export async function fetchRun(id: string) {
  if (!API) return findDemoRun(id);
  try {
    const res = await fetch(`${API}/api/runs/${id}`);
    if (!res.ok) return findDemoRun(id);
    return (await res.json()) as ReturnType<typeof findDemoRun>;
  } catch {
    return findDemoRun(id);
  }
}
