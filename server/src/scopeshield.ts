/** Log-only env guard. Does not process.exit unless SCOPESHIELD_STRICT=1. Never prints values. */

type Failure = { name: string; reason: string; constraint: string };

function present(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function preflight(): { ok: boolean; service: string; failures: Failure[] } {
  const failures: Failure[] = [];
  const db = present("DATABASE_URL");
  if (!db) {
    failures.push({ name: "DATABASE_URL", reason: "missing", constraint: "required" });
  } else {
    if (!/^postgres(ql)?(\+psycopg)?:\/\//i.test(db)) {
      failures.push({ name: "DATABASE_URL", reason: "type", constraint: "type:postgres_url" });
    }
    const lower = db.toLowerCase();
    if (lower.includes("sujvxxrwjqsziswuazwm") || lower.includes("nano-sandbox")) {
      failures.push({ name: "DATABASE_URL", reason: "forbidden_substring", constraint: "sujvxxrwjqsziswuazwm" });
    }
  }
  const hook = present("GITHUB_WEBHOOK_SECRET");
  if (!hook) {
    failures.push({ name: "GITHUB_WEBHOOK_SECRET", reason: "missing", constraint: "required" });
  } else if (hook.length < 8) {
    failures.push({ name: "GITHUB_WEBHOOK_SECRET", reason: "too_short", constraint: "min_length:8" });
  }
  const idojo = present("INCIDENTDOJO_URL");
  if (idojo) {
    if (!idojo.startsWith("https://")) {
      failures.push({ name: "INCIDENTDOJO_URL", reason: "type", constraint: "type:https_url" });
    }
    const lower = idojo.toLowerCase();
    if (lower.includes("postgres") || lower.includes("supabase.com")) {
      failures.push({ name: "INCIDENTDOJO_URL", reason: "forbidden_substring", constraint: "postgres" });
    }
  }
  return { ok: failures.length === 0, service: "causalrail", failures };
}

export function runBootPreflight(): void {
  const report = preflight();
  console.log(JSON.stringify({ scopeshield: report }));
  if (!report.ok && process.env.SCOPESHIELD_STRICT === "1") {
    process.exit(1);
  }
}
