-- CausalRail — Supabase PostgreSQL DDL
-- Apply in the SQL editor or via supabase db push.

create extension if not exists pgcrypto;

create table if not exists build_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  github_run_id bigint,
  repo text not null,
  workflow_name text not null,
  job_name text,
  branch text,
  sha text,
  status text not null check (status in ('success', 'failure', 'cancelled', 'in_progress')),
  conclusion text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  compute_cost_usd numeric(10, 4) not null default 0,
  saved_cost_usd numeric(10, 4) not null default 0,
  fingerprint text,
  raw_log text,
  normalized_trace text,
  is_flaky boolean not null default false,
  rerun_of uuid references build_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists build_runs_user_id_idx on build_runs (user_id);
create index if not exists build_runs_fingerprint_idx on build_runs (fingerprint);
create index if not exists build_runs_repo_workflow_idx on build_runs (repo, workflow_name);
create index if not exists build_runs_created_at_idx on build_runs (created_at desc);
create index if not exists build_runs_status_idx on build_runs (user_id, status);

create table if not exists failure_analysis (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  build_run_id uuid not null references build_runs (id) on delete cascade,
  fingerprint text not null,
  root_cause text,
  category text not null check (
    category in ('assertion', 'timeout', 'flake', 'infra', 'dependency', 'oom', 'unknown')
  ),
  confidence numeric(4, 3) not null default 0,
  llm_used boolean not null default false,
  counterfactual_result text check (
    counterfactual_result is null
    or counterfactual_result in ('same_failure', 'passed', 'different_failure', 'pending')
  ),
  created_at timestamptz not null default now()
);

create index if not exists failure_analysis_user_id_idx on failure_analysis (user_id);
create index if not exists failure_analysis_fingerprint_idx on failure_analysis (fingerprint);
create index if not exists failure_analysis_build_run_id_idx on failure_analysis (build_run_id);
create index if not exists failure_analysis_category_idx on failure_analysis (category);
