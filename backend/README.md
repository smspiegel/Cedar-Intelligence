# Cedar monitor backend

Cedar is a tenant-isolated Fastify service for search-based monitoring. A monitor has up to five web queries, one natural-language trigger, one fixed finding bucket, and an enabled flag.

## Execution flow

1. `POST /v1/monitors/:id/executions` stores an immutable monitor snapshot and dispatches the existing Render Workflow task.
2. The workflow searches each query with Exa's standard Search API.
3. Results are URL-normalized and deduplicated across queries.
4. Each result not already processed by that monitor is evaluated independently against the trigger.
5. Matches become idempotent findings in the monitor's configured `threat`, `flag`, or `opportunity` bucket.
6. The execution records completed/failed status and result, evaluation, and finding counts.

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
- `GET /v1/me`, plus public `GET /health` and `GET /ready`

Monitor edits require `If-Match: <version>`. Deletes are soft deletes: future runs stop and historical findings remain.

## Scheduling and deployment

The root `render.yaml` defines the API, workflow, static Expo site, and one `cedar-monitor-scheduler` cron job. The cron runs every six hours and dispatches every enabled monitor through the same workflow path as Run Now. It skips monitors with queued or running executions and uses a deterministic six-hour idempotency key.

Set the following secrets on Render:

- API: Clerk values, SurrealDB values, `RENDER_API_KEY`, and `RENDER_WORKFLOW_SLUG`.
- Workflow: SurrealDB values, `EXA_API_KEY`, evaluator URL/key/model, and optionally `EXA_RESULTS_PER_QUERY`.
- Scheduler: SurrealDB values, `RENDER_API_KEY`, and `RENDER_WORKFLOW_SLUG`.
- Frontend: `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.

The API pre-deploy command applies ordered, additive SurrealDB migrations. Migration `003_simplified_monitors.surql` retains legacy schemaless records and adds indexes for the simplified access patterns.

## Verification

```bash
npm run build
npm test
```
