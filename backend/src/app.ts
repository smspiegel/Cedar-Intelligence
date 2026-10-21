import Fastify from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "./config.js";
import type { Repository, WorkflowDispatcher } from "./ports.js";
import { MonitorRunError, MonitorService } from "./services/monitor-service.js";

export function buildApp(config: AppConfig, repo: Repository, dispatcher: WorkflowDispatcher) {
  const app = Fastify({ logger: config.NODE_ENV !== "test" }), service = new MonitorService(repo, dispatcher);
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    if (request.headers.authorization !== `Bearer ${config.API_TOKEN}`) return reply.code(401).send({ error: "Unauthorized" });
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: "Validation failed", details: error.issues });
    if (error instanceof MonitorRunError) return reply.code(error.statusCode).send({ error: error.message });
    app.log.error(error); return reply.code(500).send({ error: "Internal server error" });
  });
  app.get("/health", async () => ({ status: "ok" }));
  app.post("/monitors", async (request, reply) => reply.code(201).send(await service.create(config.TENANT_ID, request.body)));
  app.get("/monitors", async () => service.list(config.TENANT_ID));
  app.patch<{ Params: { id: string } }>("/monitors/:id", async (request, reply) => {
    const value = await service.patch(config.TENANT_ID, request.params.id, request.body);
    return value ?? reply.code(404).send({ error: "Monitor not found" });
  });
  app.post<{ Params: { id: string } }>("/monitors/:id/run", async (request, reply) => reply.code(202).send(await service.run(config.TENANT_ID, request.params.id)));
  app.get<{ Params: { id: string } }>("/executions/:id", async (request, reply) => {
    const value = await repo.getExecution(config.TENANT_ID, request.params.id);
    return value ?? reply.code(404).send({ error: "Execution not found" });
  });
  app.get<{ Querystring: { monitorId?: string } }>("/findings", async request => repo.listFindings(config.TENANT_ID, request.query.monitorId));
  app.addHook("onClose", async () => repo.close());
  return app;
}

