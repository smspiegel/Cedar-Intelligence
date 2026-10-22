import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryRepository } from "../src/adapters/in-memory-repository.js";
import { MonitorService } from "../src/services/monitor-service.js";
import { MonitorExecutor } from "../src/services/executor.js";
import type { ContextProvider, FindingEvaluator } from "../src/ports.js";
import type { EvaluationResult, Monitor, Observation } from "../src/domain.js";
import { now, newId } from "../src/utils.js";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

class RuleEvaluator implements FindingEvaluator {
  async evaluate({ monitor, observations, context }: { monitor: Monitor; observations: Observation[]; context: string }): Promise<EvaluationResult> {
    const relevant = context.includes("ignore launches") ? [] : observations.filter(o => o.content.includes("Project Birch") && monitor.instructions.includes("Project Birch"));
    return { verdicts: relevant.length ? [{ verdict: "match", title: "Project Birch launch", rationale: `Matched using context: ${context}`, observationIds: relevant.map(o => o.id) }] : [{ verdict: "no_match", title: "No matching launch", rationale: "No supplied evidence matched.", observationIds: [] }] };
  }
}
const contexts: ContextProvider = { async retrieve(org, monitor) { return { text: `${org.context}\n${monitor.context}`, reference: "test-context" }; } };
const config: AppConfig = {
  NODE_ENV: "test", PORT: 3000, AUTH_MODE: "development", API_TOKEN: "test-api-token", AUTH_TENANT_CLAIM: "org_id", CORS_ORIGINS: [], TENANT_ID: "tenant-a",
  SURREAL_URL: "ws://localhost:8000/rpc", SURREAL_NAMESPACE: "cedar", SURREAL_DATABASE: "cedar", SURREAL_USERNAME: "root", SURREAL_PASSWORD: "root",
  RENDER_WORKFLOW_SLUG: "cedar", EVALUATOR_MODEL: "test", SEEDED_CONTEXT: "seed",
};

describe("Cedar monitor execution", () => {
  let repo: InMemoryRepository, service: MonitorService, executor: MonitorExecutor;
  beforeEach(async () => {
    repo = new InMemoryRepository(); service = new MonitorService(repo, { async start() { return "trn-test"; } });
    executor = new MonitorExecutor(repo, contexts, new RuleEvaluator());
    await repo.putOrganization({ id: "tenant-a", name: "A", context: "launches matter" });
    await repo.putOrganization({ id: "tenant-b", name: "B", context: "other tenant" });
  });
  async function monitor(fixture: "matching" | "nonmatching" | "duplicate" | "changed" | "failure" = "matching", priority: "P1" | "P2" | "P3" = "P2") {
    return service.create("tenant-a", { name: "Launch", instructions: "Find Project Birch launches", priority, enabled: true, sources: [{ type: "mock", key: "feed", fixture }], memoryScope: "org/a", context: "" });
  }
  async function execute(m: Monitor) {
    const e = { id: newId(), tenantId: m.tenantId, monitorId: m.id, monitorVersion: m.version, status: "queued" as const, createdAt: now() };
    await repo.createExecution(e); await executor.execute(e.id); return e;
  }
  it("creates a matching finding with monitor priority", async () => { const m = await monitor("matching", "P1"); await execute(m); expect(await repo.listFindings("tenant-a")).toMatchObject([{ priority: "P1", monitorId: m.id }]); });
  it("does not create a finding for a nonmatch", async () => { await execute(await monitor("nonmatching")); expect(await repo.listFindings("tenant-a")).toHaveLength(0); });
  it("does not duplicate findings when identical observations replay", async () => { const m = await monitor(); await execute(m); await execute(m); expect(await repo.listFindings("tenant-a")).toHaveLength(1); });
  it("uses an updated priority only for future findings", async () => {
    const m = await monitor("matching", "P3"); await execute(m);
    const updated = await service.patch("tenant-a", m.id, { priority: "P1", sources: [{ type: "mock", key: "feed", fixture: "changed" }] });
    await execute(updated!); expect((await repo.listFindings("tenant-a")).map(f => f.priority).sort()).toEqual(["P1", "P3"]);
  });
  it("executes the monitor snapshot captured at dispatch time", async () => {
    const m = await monitor("matching", "P2");
    const execution = await service.run("tenant-a", m.id);
    await service.patch("tenant-a", m.id, { priority: "P1", sources: [{ type: "mock", key: "feed", fixture: "nonmatching" }] });
    await executor.execute(execution.id);
    expect(await repo.getExecution("tenant-a", execution.id)).toMatchObject({ monitorVersion: 1, status: "completed" });
    expect(await repo.listFindings("tenant-a")).toMatchObject([{ priority: "P2", monitorId: m.id }]);
  });
  it("returns the original execution for an idempotent dispatch", async () => {
    let starts = 0;
    const idempotentService = new MonitorService(repo, { async start() { starts += 1; return "run"; } });
    const m = await idempotentService.create("tenant-a", { name: "Launch", instructions: "Find Project Birch launches", priority: "P2", sources: [{ type: "mock", key: "feed", fixture: "matching" }] });
    const first = await idempotentService.run("tenant-a", m.id, "client-press-1");
    const second = await idempotentService.run("tenant-a", m.id, "client-press-1");
    expect(second.id).toBe(first.id);
    expect(starts).toBe(1);
  });
  it("allows organization context to affect evaluation", async () => {
    const m = await monitor(); await repo.putOrganization({ id: "tenant-a", name: "A", context: "ignore launches" }); await execute(m);
    expect(await repo.listFindings("tenant-a")).toHaveLength(0);
    await repo.putOrganization({ id: "tenant-a", name: "A", context: "launches matter" }); await execute(m);
    expect(await repo.listFindings("tenant-a")).toHaveLength(1);
  });
  it("records collection failure as failed", async () => {
    const m = await monitor("failure"), e = { id: newId(), tenantId: m.tenantId, monitorId: m.id, monitorVersion: m.version, status: "queued" as const, createdAt: now() };
    await repo.createExecution(e); await expect(executor.execute(e.id)).rejects.toThrow("failed as requested");
    expect(await repo.getExecution("tenant-a", e.id)).toMatchObject({ status: "failed", error: expect.stringContaining("failed as requested") });
    await expect(executor.execute(e.id)).rejects.toThrow("failed as requested");
    expect(await repo.getExecution("tenant-a", e.id)).toMatchObject({ status: "failed" });
  });
  it("enforces tenant boundaries and server-controlled tenant identity", async () => {
    const m = await monitor(); const app = buildApp(config, repo, { async start() { return "run"; } });
    expect((await app.inject({ method: "GET", url: `/executions/missing`, headers: { authorization: "Bearer test-api-token", "x-tenant-id": "tenant-b" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/monitors", headers: { authorization: "Bearer test-api-token", "x-tenant-id": "tenant-b" } })).json()).toMatchObject([{ id: m.id, tenantId: "tenant-a" }]);
    expect((await app.inject({ method: "GET", url: "/monitors" })).statusCode).toBe(401); await app.close();
  });
  it("serves a versioned monitor read model without tenant internals", async () => {
    const m = await monitor();
    const app = buildApp(config, repo, { async start() { return "run"; } });
    const response = await app.inject({ method: "GET", url: "/v1/monitors", headers: { authorization: "Bearer test-api-token" } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ data: [{ id: m.id, lastExecution: null }], meta: { hasMore: false } });
    expect(response.json().data[0]).not.toHaveProperty("tenantId");
    const started = await app.inject({ method: "POST", url: `/v1/monitors/${m.id}/executions`, headers: { authorization: "Bearer test-api-token" } });
    expect(started.statusCode).toBe(202);
    expect(started.headers.location).toContain("/v1/executions/");
    await app.close();
  });
  it("requires an optimistic concurrency version for v1 monitor edits", async () => {
    const m = await monitor();
    const app = buildApp(config, repo, { async start() { return "run"; } });
    const missingVersion = await app.inject({ method: "PATCH", url: `/v1/monitors/${m.id}`, headers: { authorization: "Bearer test-api-token" }, payload: { name: "Changed" } });
    expect(missingVersion.statusCode).toBe(428);
    const updated = await app.inject({ method: "PATCH", url: `/v1/monitors/${m.id}`, headers: { authorization: "Bearer test-api-token", "if-match": "1" }, payload: { name: "Changed" } });
    expect(updated.statusCode).toBe(200);
    const stale = await app.inject({ method: "PATCH", url: `/v1/monitors/${m.id}`, headers: { authorization: "Bearer test-api-token", "if-match": "1" }, payload: { name: "Changed again" } });
    expect(stale.statusCode).toBe(409);
    await app.close();
  });
});
