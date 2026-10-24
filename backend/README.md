# Cedar monitor backend

Cedar is a tenant-isolated Fastify service for search-based monitoring. A monitor has up to five web queries, one natural-language trigger, one fixed finding bucket, and an enabled flag.

## Execution flow

1. `POST /v1/monitors/:id/executions` stores an immutable monitor snapshot and dispatches the existing Render Workflow task.
2. The workflow searches each query with Exa's standard Search API.
3. Results are URL-normalized and deduplicated across queries.
4. New or changed result content is stored as a revision and evaluated against the trigger. Every match and non-match is retained as an evaluation record.
5. Before evaluation, Cedar recalls monitor-scoped prior findings and human decisions from SurrealDB Agent Memory. In `assist` mode that history helps classify a candidate as new, updated, recurring, or unchanged; current evidence remains authoritative.
6. Matches create or update a stable finding while preserving its human workflow state. Finding events are written to an append-only audit trail and a durable Agent Memory outbox.
7. The execution records completed/failed status, counts, and Agent Memory recall trace metadata.

Observations retain the title, excerpt, query, canonical URL, original source URL, and publication date when available. A stable monitor-plus-URL key prevents duplicate findings across reruns. Search and evaluator failures are persisted on the execution and rethrown so Render retries remain effective.

## Local setup

Requirements: Node.js 22+, SurrealDB 3.x, and Render CLI 2.12+ for local workflow execution.

```bash
cp .env.example .env
npm install
surreal start --user root --pass root memory
npm run migrate
npm run seed
```

Configure `EXA_API_KEY`, `EVALUATOR_URL`, `EVALUATOR_API_KEY`, and `EVALUATOR_MODEL`. The evaluator endpoint must implement OpenAI-compatible Chat Completions structured JSON output.

Run the local task server and API in separate terminals:

```bash
npm run workflow:dev
npm run dev
```

With `RENDER_USE_LOCAL_DEV=true`, Run Now dispatches to the local task server. Development requests use `Authorization: Bearer $API_TOKEN`; production uses Clerk JWT validation and derives the tenant from `AUTH_TENANT_CLAIM`.

Development mode accepts browser requests from loopback origins such as Expo Web at `http://localhost:8081`. Set `CORS_ORIGINS` to a comma-separated allowlist for non-local development origins and all production web origins.

Create a monitor:

```bash
curl -H "Authorization: Bearer $API_TOKEN" -H 'content-type: application/json' \
  -d '{"name":"Competitor launches","queries":["enterprise AI product launch","AI governance platform launch"],"trigger":"A competitor announced a major enterprise product or feature.","bucket":"flag","enabled":true}' \
  http://localhost:3000/v1/monitors
```

## API

- `GET|POST /v1/monitors`
- `GET|PATCH|DELETE /v1/monitors/:id`
- `POST|GET /v1/monitors/:id/executions`
- `GET /v1/executions/:id`
- `GET /v1/findings`
- `GET /v1/findings/:id` (includes observation evidence)
- `POST /v1/findings/:id/events` (requires `If-Match`; records relevance, workflow state, or a note)
- `GET /v1/findings/:id/history`
- `GET /v1/me`, plus public `GET /health` and `GET /ready`

Monitor edits and finding decisions require `If-Match: <version>`. Findings support `unreviewed`, `monitoring`, `action_underway`, `resolved`, and `dismissed` workflow states plus `unknown`, `confirmed`, and `false_positive` relevance. Deletes are soft deletes: future runs stop and historical findings remain.

## Agent Memory rollout

Configure the same Agent Memory values on the API and workflow services:

- `AGENT_MEMORY_ENDPOINT`, `AGENT_MEMORY_CONTEXT`, and `AGENT_MEMORY_API_KEY`
- `AGENT_MEMORY_MODE=shadow` to exercise writes and recalls without adding recalled memory to evaluator prompts
- `AGENT_MEMORY_MODE=assist` after trace review to add recalled context to evaluations
- optionally `AGENT_MEMORY_PRINCIPAL_PREFIX` to use delegated tenant principals

Memory is isolated by `org/<tenant>/monitor/<monitor>` scope. Cedar registers the scope on the first recall or write; the Agent Memory key therefore needs `scope:create` in addition to `memory:read` and `memory:write` over the Cedar organisation subtree. The API writes human review decisions through a durable outbox even while memory mode is off. Before recall, the workflow automatically projects any older findings or event history that predates the outbox, flushes outstanding entries, and flushes again after processing. Recall is fail-open, so an Agent Memory outage does not stop monitoring. Outbox failures remain retryable in SurrealDB and their latest error is exposed on execution records.

After migration and after Agent Memory credentials are configured, seed findings that predate the event log once:

```bash
AGENT_MEMORY_MODE=shadow npm run memory:backfill
```

The command is idempotent and projects both legacy findings and existing event history that does not yet have an outbox record. Keep `shadow` enabled for initial production runs, inspect the `memoryStatus`, `memoryError`, `memoryTraceId`, hit count, tier, and query latency on executions, then switch both API and workflow to `assist`.

## Scheduling and deployment

The root `render.yaml` defines the API, workflow, static Expo site, and one `cedar-monitor-scheduler` cron job. The cron runs every six hours and dispatches every enabled monitor through the same workflow path as Run Now. It skips monitors with queued or running executions and uses a deterministic six-hour idempotency key.

Set the following secrets on Render:

- API: Clerk values, SurrealDB values, Agent Memory values, `RENDER_API_KEY`, and `RENDER_WORKFLOW_SLUG`.
- Workflow: SurrealDB values, Agent Memory values, `EXA_API_KEY`, evaluator URL/key/model, and optionally `EXA_RESULTS_PER_QUERY`.
- Scheduler: SurrealDB values, `RENDER_API_KEY`, and `RENDER_WORKFLOW_SLUG`.
- Frontend: `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

The API pre-deploy command applies ordered, additive SurrealDB migrations. Migration `004_finding_memory.surql` backfills finding workflow defaults and adds evaluation, finding-event, memory-outbox, and observation-revision indexes.

## Verification

```bash
npm run build
npm test
```
