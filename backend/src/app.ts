import cors from "@fastify/cors";
import Fastify, { type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { createAuthProvider, type AuthContext } from "./auth.js";
import type { AppConfig } from "./config.js";
import type { ExecutionRecord, Finding, Monitor, Observation } from "./domain.js";
import type { Repository, WorkflowDispatcher } from "./ports.js";
import { MonitorRunError, MonitorService } from "./services/monitor-service.js";

declare module "fastify" {
  interface FastifyRequest { auth: AuthContext }
}

const withoutTenant = <T extends { tenantId: string }>(value: T): Omit<T, "tenantId"> => {
  const { tenantId: _tenantId, ...publicValue } = value;
  return publicValue;
};

const monitorDto = (monitor: Monitor) => withoutTenant(monitor);
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

export function buildApp(config: AppConfig, repo: Repository, dispatcher: WorkflowDispatcher) {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });
  const service = new MonitorService(repo, dispatcher);
  const auth = createAuthProvider(config);
  app.decorateRequest("auth", null as unknown as AuthContext);
  app.register(cors, {
    credentials: true,
    origin: (origin, callback) => {
      // Native clients have no browser Origin header. Web clients must be explicitly allowed.
      if (!origin) return callback(null, true);
      return callback(null, config.CORS_ORIGINS.includes(origin));
    },
  });
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health" || request.url === "/ready") return;
    const context = await auth.authenticate(request.headers.authorization);
    if (!context) return reply.code(401).send(errorBody(request, "UNAUTHENTICATED", "Authentication is required"));
    request.auth = context;
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send(errorBody(request, "VALIDATION_FAILED", "Validation failed", error.issues));
    if (error instanceof MonitorRunError) return reply.code(error.statusCode).send(errorBody(request, "MONITOR_RUN_FAILED", error.message));
    app.log.error(error);
    return reply.code(500).send(errorBody(request, "INTERNAL", "Internal server error"));
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => { await repo.ping(); return { status: "ready" }; });

  // Existing MVP routes remain available for a short migration window.
  app.post("/monitors", async (request, reply) => reply.code(201).send(await service.create(request.auth.tenantId, request.body)));
  app.get("/monitors", async request => service.list(request.auth.tenantId));
  app.patch<{ Params: { id: string } }>("/monitors/:id", async (request, reply) => {
    const value = await service.patch(request.auth.tenantId, request.params.id, request.body);
    return value ?? reply.code(404).send(errorBody(request, "NOT_FOUND", "Monitor not found"));
  });
  app.post<{ Params: { id: string } }>("/monitors/:id/run", async (request, reply) => reply.code(202).send(await service.run(request.auth.tenantId, request.params.id)));
  app.get<{ Params: { id: string } }>("/executions/:id", async (request, reply) => {
    const value = await repo.getExecution(request.auth.tenantId, request.params.id);
    return value ?? reply.code(404).send(errorBody(request, "NOT_FOUND", "Execution not found"));
  });
  app.get<{ Querystring: { monitorId?: string } }>("/findings", async request => repo.listFindings(request.auth.tenantId, request.query.monitorId));

  app.get("/v1/me", async request => ({ data: { tenantId: request.auth.tenantId, subject: request.auth.subject, roles: request.auth.roles } }));
  app.get<{ Querystring: { limit?: string } }>("/v1/monitors", async request => {
    const monitors = await service.list(request.auth.tenantId);
    const limit = clampLimit(request.query.limit);
    const page = monitors.slice(0, limit);
    const data = await Promise.all(page.map(async monitor => {
      const [lastExecution] = await repo.listExecutions(request.auth.tenantId, monitor.id, 1);
      return { ...monitorDto(monitor), lastExecution: lastExecution ? executionDto(lastExecution) : null };
    }));
    return { data, meta: { limit, hasMore: monitors.length > page.length } };
  });
  app.post("/v1/monitors", async (request, reply) => {
    const monitor = await service.create(request.auth.tenantId, request.body);
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
    return { data: monitorDto(monitor) };
  });
  app.post<{ Params: { id: string } }>("/v1/monitors/:id/executions", async (request, reply) => {
    const execution = await service.run(request.auth.tenantId, request.params.id, idempotencyKey(request.headers["idempotency-key"]));
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
    const observations = await repo.getObservations(request.auth.tenantId, finding.observationIds);
    return { data: { ...findingDto(finding), observations: observations.map(observationDto) } };
  });

  app.addHook("onClose", async () => repo.close());
  return app;
}
