import cors from "@fastify/cors";
import Fastify, { type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { PostHog } from "posthog-node";
import { createAuthProvider, type AuthContext } from "./auth.js";
import type { AppConfig } from "./config.js";
import type { ExecutionRecord, Finding, Monitor, Observation } from "./domain.js";
import type { Repository, WorkflowDispatcher } from "./ports.js";
import { MonitorRunError, MonitorService } from "./services/monitor-service.js";
import type { PostHogLogCapture } from "./posthog-logs.js";

declare module "fastify" {
  interface FastifyRequest { auth: AuthContext }
}

const withoutTenant = <T extends { tenantId: string }>(value: T): Omit<T, "tenantId"> => {
  const { tenantId: _tenantId, ...publicValue } = value;
  return publicValue;
};

const monitorDto = (monitor: Monitor) => {
  const { deletedAt: _deletedAt, ...value } = withoutTenant(monitor);
  return value;
};
const executionDto = (execution: ExecutionRecord) => {
  const { monitorSnapshot: _monitorSnapshot, ...publicExecution } = withoutTenant(execution);
  return publicExecution;
};
const observationDto = (observation: Observation) => withoutTenant(observation);
const findingDto = (finding: Finding) => withoutTenant(finding);

const clampLimit = (raw: unknown) => {
  const value = typeof raw === "string" ? Number(raw) : Number.NaN;
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 100) : 50;
};

const expectedVersion = (header: string | string[] | undefined) => {
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const match = raw.match(/^"?(\d+)"?$/);
  return match ? Number(match[1]) : null;
};

const idempotencyKey = (header: string | string[] | undefined) => {
  const value = Array.isArray(header) ? header[0] : header;
  return value && value.length <= 200 ? value : undefined;
};

const errorBody = (request: FastifyRequest, code: string, message: string, details?: unknown) => ({
  error: { code, message, ...(details === undefined ? {} : { details }), requestId: request.id },
});

const isAllowedOrigin = (config: AppConfig, origin: string) => {
  if (config.CORS_ORIGINS.includes(origin)) return true;
  if (config.NODE_ENV !== "development") return false;
  try {
    const { hostname, protocol } = new URL(origin);
    return (protocol === "http:" || protocol === "https:")
      && (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]");
  } catch {
    return false;
  }
};

export function buildApp(config: AppConfig, repo: Repository, dispatcher: WorkflowDispatcher, posthog?: PostHog, posthogLogs?: PostHogLogCapture) {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });
  const service = new MonitorService(repo, dispatcher);
  const auth = createAuthProvider(config);
  app.decorateRequest("auth", null as unknown as AuthContext);
  app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"],
    origin: (origin, callback) => {
      // Native clients have no browser Origin header. Web clients must be explicitly allowed.
      if (!origin) return callback(null, true);
      return callback(null, isAllowedOrigin(config, origin));
    },
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health" || request.url === "/ready") return;
    const context = await auth.authenticate(request.headers.authorization);
    if (!context) return reply.code(401).send(errorBody(request, "UNAUTHENTICATED", "Authentication is required"));
    request.auth = context;
    if (context.subject) posthog?.enterContext({ distinctId: context.subject }, { fresh: true });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send(errorBody(request, "VALIDATION_FAILED", "Validation failed", error.issues));
    if (error instanceof MonitorRunError) return reply.code(error.statusCode).send(errorBody(request, error.code, error.message));
    posthog?.captureException(error, request.auth?.subject);
    app.log.error(error);
    return reply.code(500).send(errorBody(request, "INTERNAL", "Internal server error"));
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => { await repo.ping(); return { status: "ready" }; });

  app.get("/v1/me", async request => ({ data: { tenantId: request.auth.tenantId, subject: request.auth.subject, roles: request.auth.roles } }));
  app.get<{ Querystring: { limit?: string } }>("/v1/monitors", async request => {
    const monitors = await service.list(request.auth.tenantId);
    const limit = clampLimit(request.query.limit);
    const page = monitors.slice(0, limit);
    const data = await Promise.all(page.map(async monitor => {
      const [[lastExecution], findingsCount] = await Promise.all([
        repo.listExecutions(request.auth.tenantId, monitor.id, 1), repo.countFindings(request.auth.tenantId, monitor.id),
      ]);
      return { ...monitorDto(monitor), lastExecution: lastExecution ? executionDto(lastExecution) : null, findingsCount };
    }));
    return { data, meta: { limit, hasMore: monitors.length > page.length } };
  });
  app.post("/v1/monitors", async (request, reply) => {
    const monitor = await service.create(request.auth.tenantId, request.body);
    posthog?.capture({
      event: "monitor_created",
      properties: { bucket: monitor.bucket, query_count: monitor.queries.length, enabled: monitor.enabled },
    });
    return reply.code(201).send({ data: monitorDto(monitor) });
  });
  app.get<{ Params: { id: string } }>("/v1/monitors/:id", async (request, reply) => {
    const monitor = await repo.getMonitor(request.auth.tenantId, request.params.id);
    if (!monitor) return reply.code(404).send(errorBody(request, "NOT_FOUND", "Monitor not found"));
    const executions = await repo.listExecutions(request.auth.tenantId, monitor.id, 10);
    return { data: { ...monitorDto(monitor), executions: executions.map(executionDto) } };
  });
  app.patch<{ Params: { id: string } }>("/v1/monitors/:id", async (request, reply) => {
    const version = expectedVersion(request.headers["if-match"]);
    if (version === null) return reply.code(428).send(errorBody(request, "PRECONDITION_REQUIRED", "If-Match must contain the monitor version"));
    const monitor = await service.patch(request.auth.tenantId, request.params.id, request.body, version);
    if (!monitor) return reply.code(404).send(errorBody(request, "NOT_FOUND", "Monitor not found"));
    posthog?.capture({
      event: "monitor_updated",
      properties: { bucket: monitor.bucket, query_count: monitor.queries.length, enabled: monitor.enabled, version: monitor.version },
    });
    return { data: monitorDto(monitor) };
  });
  app.delete<{ Params: { id: string } }>("/v1/monitors/:id", async (request, reply) => {
    if (!await service.remove(request.auth.tenantId, request.params.id)) return reply.code(404).send(errorBody(request, "NOT_FOUND", "Monitor not found"));
    posthog?.capture({ event: "monitor_deleted", properties: { deletion_type: "archive" } });
    return reply.code(204).send();
  });
  app.post<{ Params: { id: string } }>("/v1/monitors/:id/executions", async (request, reply) => {
    const execution = await service.run(request.auth.tenantId, request.params.id, idempotencyKey(request.headers["idempotency-key"]));
    posthog?.capture({
      event: "monitor_execution_queued",
      properties: { monitor_version: execution.monitorVersion, uses_idempotency_key: Boolean(idempotencyKey(request.headers["idempotency-key"])) },
    });
    posthogLogs?.info("monitor execution queued", { monitor_version: execution.monitorVersion });
    return reply.code(202).header("location", `/v1/executions/${execution.id}`).send({ data: executionDto(execution) });
  });
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>("/v1/monitors/:id/executions", async (request, reply) => {
    const monitor = await repo.getMonitor(request.auth.tenantId, request.params.id);
    if (!monitor) return reply.code(404).send(errorBody(request, "NOT_FOUND", "Monitor not found"));
    const limit = clampLimit(request.query.limit);
    const data = await repo.listExecutions(request.auth.tenantId, monitor.id, limit);
    return { data: data.map(executionDto), meta: { limit } };
  });
  app.get<{ Params: { id: string } }>("/v1/executions/:id", async (request, reply) => {
    const execution = await repo.getExecution(request.auth.tenantId, request.params.id);
    if (!execution) return reply.code(404).send(errorBody(request, "NOT_FOUND", "Execution not found"));
    return { data: executionDto(execution) };
  });
  app.get<{ Querystring: { monitorId?: string } }>("/v1/findings", async request => ({
    data: (await repo.listFindings(request.auth.tenantId, request.query.monitorId)).map(findingDto),
  }));
  app.get<{ Params: { id: string } }>("/v1/findings/:id", async (request, reply) => {
    const finding = await repo.getFinding(request.auth.tenantId, request.params.id);
    if (!finding) return reply.code(404).send(errorBody(request, "NOT_FOUND", "Finding not found"));
    const observations = await repo.getObservations(request.auth.tenantId, [finding.observationId]);
    return { data: { ...findingDto(finding), observations: observations.map(observationDto) } };
  });

  app.addHook("onClose", async () => {
    await Promise.all([repo.close(), posthog?.shutdown(), posthogLogs?.shutdown()]);
  });
  return app;
}
