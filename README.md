# CausalRail

CI failure attribution. GitHub webhooks land, stack traces are normalized with a deterministic regex engine, and each unique failure gets a SHA-256 fingerprint. Counterfactual reruns (Octokit `workflow_dispatch`) tell flakes from regressions. Compute you would have spent re-debugging a known fingerprint is recorded as savings.

Dashboard: GitHub Pages. API: Render. Database: Supabase Postgres.

## Layout

```
client/    React 18 + Vite + Tailwind (HashRouter, base: './')
server/    Express + TypeScript
schema.sql Supabase DDL (build_runs, failure_analysis)
```

## Board

The dispatch board shows a 14-day failure matrix, flaky signatures (same fingerprint, mixed pass/fail), and compute saved versus spent. The trace inspector is a split pane: raw log on the left, normalized frames + fingerprint on the right.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/webhooks/github` | HMAC `X-Hub-Signature-256`, `workflow_run` completed/failure |
| `GET` | `/api/dashboard` | Runs + analyses for `?user=` |
| `GET` | `/api/runs/:id` | Run, analysis, sibling fingerprints |
| `POST` | `/api/ingest` | `{ repo, workflow, rawLog }` |
| `POST` | `/api/normalize` | Stack-trace normalizer (no DB) |
| `POST` | `/api/runs/:id/rerun` | Octokit counterfactual dispatch |
| `GET` | `/health` | Liveness |

Unknown stacks (no frames + no regex category) fall through to OpenRouter.

## Local

```bash
# API
cd server && npm ci && npm run dev

# Dashboard
cd client && npm ci && npm run dev
```

Copy `.env.example` to `server/.env`. Apply `schema.sql` on Supabase, set `DATABASE_URL`. Point `VITE_API_URL` at the API when you want live data; without it the Pages build ships a self-contained demo rail.

## Deploy

**Pages.** Push to `main`. `.github/workflows/deploy.yml` builds `client/` and publishes `client/dist` to `gh-pages`. Enable Pages on the `gh-pages` branch. Optional repo variable `API_URL` becomes `VITE_API_URL`.

**Render.** Use `render.yaml` (`causalrail-api`, root `server`). Set `DATABASE_URL`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN`, `OPENROUTER_API_KEY`, `CLIENT_ORIGIN`.

**GitHub webhook.** `POST https://<render-host>/webhooks/github`, content type JSON, secret matching `GITHUB_WEBHOOK_SECRET`, events: `workflow_run`.

## Engine

Normalization strips ANSI, timestamps, PIDs, hex addresses, absolute paths, and runner noise, then keeps user-code frames (`js` / `python` / `java` / `go` / `ruby`). The canonical frame list is SHA-256'd. Same assertion on two runners hashes identically.

Counterfactual mode dispatches the same workflow/ref with:

```
causalrail_fingerprint
causalrail_parent_run
causalrail_mode=counterfactual
```
