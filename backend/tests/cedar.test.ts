import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "../src/adapters/in-memory-repository.js";
import { MonitorService } from "../src/services/monitor-service.js";
import { MonitorExecutor } from "../src/services/executor.js";
import { queueEnabledMonitors } from "../src/services/scheduler.js";
import type { EvaluationResult, Monitor, SearchResult } from "../src/domain.js";
import type { AppConfig } from "../src/config.js";
import type { FindingEvaluator, SearchAdapter } from "../src/ports.js";
import { buildApp } from "../src/app.js";
import { LlmFindingEvaluator } from "../src/adapters/evaluator.js";

const match: SearchResult = { url: "https://example.com/launch?utm_source=test", title: "Project Birch launches", content: "Acme launched Project Birch for enterprise teams.", publishedAt: "2026-10-20T12:00:00.000Z" };
const nonmatch: SearchResult = { url: "https://example.com/weather", title: "Weather", content: "Sunny and warm." };

class FakeSearch implements SearchAdapter {
  calls: string[] = [];
  constructor(public results: Record<string, SearchResult[] | Error>) {}
  async search(query: string) { this.calls.push(query); const value = this.results[query] ?? []; if (value instanceof Error) throw value; return structuredClone(value); }
}

class TriggerEvaluator implements FindingEvaluator {
  calls = 0;
  async evaluate({ trigger, result }: { trigger: string; result: SearchResult }): Promise<EvaluationResult> {
    this.calls += 1;
    if (!result.content.trim()) return { matched: false, title: "Insufficient evidence", reason: "The result has no usable excerpt." };
    const matched = trigger.includes("Project Birch") && result.content.includes("Project Birch");
    return matched ? { matched: true, title: result.title, reason: "The excerpt states that Acme launched Project Birch." } : { matched: false, title: "Not a match", reason: "The excerpt does not satisfy the trigger." };
  }
}

const config: AppConfig = {
  NODE_ENV: "test", PORT: 3000, AUTH_MODE: "development", API_TOKEN: "test-api-token", AUTH_TENANT_CLAIM: "org_id", CORS_ORIGINS: [], TENANT_ID: "tenant-a",
  SURREAL_URL: "ws://localhost:8000/rpc", SURREAL_NAMESPACE: "cedar", SURREAL_DATABASE: "cedar", SURREAL_USERNAME: "root", SURREAL_PASSWORD: "root",
  RENDER_WORKFLOW_SLUG: "cedar", EXA_API_URL: "https://api.exa.ai/search", EXA_RESULTS_PER_QUERY: 10, EVALUATOR_MODEL: "test",
};

describe("simplified monitors", () => {
  let repo: InMemoryRepository, service: MonitorService;
  beforeEach(() => { repo = new InMemoryRepository(); service = new MonitorService(repo, { async start() { return "run-test"; } }); });
  afterEach(() => vi.unstubAllGlobals());
  const create = (patch: Partial<{ name: string; queries: string[]; trigger: string; bucket: "threat" | "flag" | "opportunity"; enabled: boolean }> = {}) => service.create("tenant-a", {
    name: "Launch monitor", queries: ["birch launch", "Acme news"], trigger: "Match a Project Birch launch", bucket: "flag", ...patch,
  });
  const execute = async (monitor: Monitor, search: SearchAdapter, evaluator = new TriggerEvaluator()) => {
    const execution = await service.run(monitor.tenantId, monitor.id);
    await new MonitorExecutor(repo, search, evaluator).execute(execution.id);
    return { execution, evaluator };
  };

  it("creates a valid monitor and defaults enabled", async () => { const monitor = await create(); expect(monitor).toMatchObject({ enabled: true, queries: ["birch launch", "Acme news"], bucket: "flag" }); });

  it.each([
    { name: "", queries: ["valid"], trigger: "trigger", bucket: "flag" },
    { name: "name", queries: [], trigger: "trigger", bucket: "flag" },
    { name: "name", queries: ["1", "2", "3", "4", "5", "6"], trigger: "trigger", bucket: "flag" },
    { name: "name", queries: ["   "], trigger: "trigger", bucket: "flag" },
  ])("rejects an invalid monitor %#", async input => { await expect(service.create("tenant-a", input)).rejects.toThrow(); });

  it("updates trigger and bucket with optimistic concurrency", async () => {
    const monitor = await create();
    const updated = await service.patch("tenant-a", monitor.id, { trigger: "New trigger", bucket: "threat" }, 1);
    expect(updated).toMatchObject({ trigger: "New trigger", bucket: "threat", version: 2 });
    await expect(service.patch("tenant-a", monitor.id, { bucket: "opportunity" }, 1)).rejects.toThrow("Monitor has changed");
  });

  it("creates a finding for a match and copies only the configured bucket", async () => {
    const monitor = await create({ bucket: "opportunity" }); await execute(monitor, new FakeSearch({ "birch launch": [match] }));
    expect(await repo.listFindings("tenant-a")).toMatchObject([{ bucket: "opportunity", monitorId: monitor.id, sourceUrl: "https://example.com/launch" }]);
  });

  it("creates nothing for nonmatches and insufficient evidence", async () => {
    const monitor = await create();
    await execute(monitor, new FakeSearch({ "birch launch": [nonmatch, { ...match, url: "https://example.com/empty", content: "" }] }));
    expect(await repo.listFindings("tenant-a")).toHaveLength(0);
  });

  it("deduplicates canonical URLs across queries and later runs", async () => {
    const monitor = await create(); const evaluator = new TriggerEvaluator();
    const duplicate = { ...match, url: "https://EXAMPLE.com/launch/?utm_campaign=again#fragment" };
    await execute(monitor, new FakeSearch({ "birch launch": [match], "Acme news": [duplicate] }), evaluator);
    await execute(monitor, new FakeSearch({ "birch launch": [match] }), evaluator);
    expect(await repo.listFindings("tenant-a")).toHaveLength(1); expect(evaluator.calls).toBe(1);
  });

  it("completes an empty search without calling the evaluator", async () => {
    const monitor = await create(); const evaluator = new TriggerEvaluator(); const { execution } = await execute(monitor, new FakeSearch({}), evaluator);
    expect(evaluator.calls).toBe(0); expect(await repo.getExecution("tenant-a", execution.id)).toMatchObject({ status: "completed", resultCount: 0, findingsCreated: 0 });
  });

  it("records a visible search failure and succeeds on workflow retry", async () => {
    const monitor = await create({ queries: ["birch launch"] }); const search = new FakeSearch({ "birch launch": new Error("Exa unavailable") });
    const execution = await service.run("tenant-a", monitor.id); const executor = new MonitorExecutor(repo, search, new TriggerEvaluator());
    await expect(executor.execute(execution.id)).rejects.toThrow("Exa unavailable");
    expect(await repo.getExecution("tenant-a", execution.id)).toMatchObject({ status: "failed", error: "Exa unavailable" });
    search.results["birch launch"] = [match]; await executor.execute(execution.id);
    expect(await repo.getExecution("tenant-a", execution.id)).toMatchObject({ status: "completed", findingsCreated: 1 });
  });

  it("does not regress a completed execution when dispatch records its task id", async () => {
    const monitor = await create({ queries: ["birch launch"] });
    let executor: MonitorExecutor;
    const racing = new MonitorService(repo, { async start(id) { await executor.execute(id); return "render-late"; } });
    executor = new MonitorExecutor(repo, new FakeSearch({ "birch launch": [match] }), new TriggerEvaluator());
    const execution = await racing.run("tenant-a", monitor.id);
    expect(await repo.getExecution("tenant-a", execution.id)).toMatchObject({ status: "completed", renderRunId: "render-late" });
  });

  it("returns a useful 503 when the workflow runner cannot be reached", async () => {
    const monitor = await create();
    const app = buildApp(config, repo, { async start() { throw new TypeError("fetch failed"); } });
    const response = await app.inject({ method: "POST", url: `/v1/monitors/${monitor.id}/executions`, headers: { authorization: "Bearer test-api-token" } });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ error: { code: "WORKFLOW_UNAVAILABLE", message: expect.stringContaining("npm run workflow:dev") } });
    expect(await repo.listExecutions("tenant-a", monitor.id)).toMatchObject([{ status: "failed", error: "Workflow dispatch failed: fetch failed" }]);
    await app.close();
  });

  it("identifies model-provider connection failures in execution errors", async () => {
    const networkError = new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED 127.0.0.1:1234") });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(networkError));
    const evaluator = new LlmFindingEvaluator({ ...config, EVALUATOR_URL: "http://127.0.0.1:1234/v1/chat/completions", EVALUATOR_API_KEY: "test-key" });
    await expect(evaluator.evaluate({ trigger: "Match Project Birch", result: match })).rejects.toThrow("Model evaluator request failed before receiving a response: fetch failed (connect ECONNREFUSED 127.0.0.1:1234)");
  });

  it("queues enabled monitors once and skips disabled or overlapping monitors", async () => {
    const enabled = await create(); const disabled = await create({ name: "Paused", enabled: false });
    const starts: string[] = []; const dispatcher = { async start(id: string) { starts.push(id); return id; } };
    const first = await queueEnabledMonitors(repo, dispatcher, new Date("2026-10-22T12:00:00Z"));
    const second = await queueEnabledMonitors(repo, dispatcher, new Date("2026-10-22T12:05:00Z"));
    expect(first.queued).toEqual([enabled.id]); expect(second.skipped).toEqual([enabled.id]); expect(starts).toHaveLength(1);
    expect((await repo.listExecutions("tenant-a")).some(value => value.monitorId === disabled.id)).toBe(false);
  });

  it("preserves tenant isolation and serves source evidence from versioned APIs", async () => {
    const monitor = await create({ queries: ["birch launch"] }); await execute(monitor, new FakeSearch({ "birch launch": [match] }));
    await service.create("tenant-b", { name: "Other", queries: ["other"], trigger: "other", bucket: "threat" });
    const app = buildApp(config, repo, { async start() { return "run"; } }); const headers = { authorization: "Bearer test-api-token" };
    const monitors = await app.inject({ method: "GET", url: "/v1/monitors", headers });
    expect(monitors.json()).toMatchObject({ data: [{ id: monitor.id, findingsCount: 1 }] });
    expect(monitors.json().data).toHaveLength(1); expect(monitors.json().data[0]).not.toHaveProperty("tenantId");
    const findings = await app.inject({ method: "GET", url: "/v1/findings", headers }); const finding = findings.json().data[0];
    expect(finding).toMatchObject({ sourceUrl: "https://example.com/launch", bucket: "flag" });
    const detail = await app.inject({ method: "GET", url: `/v1/findings/${finding.id}`, headers });
    expect(detail.json().data.observations[0]).toMatchObject({ title: "Project Birch launches", sourceUrl: "https://example.com/launch" });
    expect((await app.inject({ method: "GET", url: "/v1/monitors" })).statusCode).toBe(401); await app.close();
  });

  it("allows Expo localhost preflights in development without opening production CORS", async () => {
    const developmentApp = buildApp({ ...config, NODE_ENV: "development" }, repo, { async start() { return "run"; } });
    const developmentPreflight = await developmentApp.inject({
      method: "OPTIONS", url: "/v1/monitors",
      headers: { origin: "http://localhost:8081", "access-control-request-method": "GET" },
    });
    expect(developmentPreflight.statusCode).toBe(204);
    expect(developmentPreflight.headers["access-control-allow-origin"]).toBe("http://localhost:8081");
    await developmentApp.close();

    const productionApp = buildApp({ ...config, NODE_ENV: "production" }, repo, { async start() { return "run"; } });
    const productionPreflight = await productionApp.inject({
      method: "OPTIONS", url: "/v1/monitors",
      headers: { origin: "http://localhost:8081", "access-control-request-method": "GET" },
    });
    expect(productionPreflight.headers["access-control-allow-origin"]).toBeUndefined();
    await productionApp.close();

    const configuredProductionApp = buildApp({ ...config, NODE_ENV: "production", CORS_ORIGINS: ["https://cedarintelligence.io"] }, repo, { async start() { return "run"; } });
    const configuredProductionPreflight = await configuredProductionApp.inject({
      method: "OPTIONS", url: "/v1/monitors",
      headers: { origin: "https://cedarintelligence.io", "access-control-request-method": "GET" },
    });
    expect(configuredProductionPreflight.statusCode).toBe(204);
    expect(configuredProductionPreflight.headers["access-control-allow-origin"]).toBe("https://cedarintelligence.io");
    await configuredProductionApp.close();
  });

  it("soft-deletes monitors without deleting findings", async () => {
    const monitor = await create({ queries: ["birch launch"] }); await execute(monitor, new FakeSearch({ "birch launch": [match] }));
    const app = buildApp(config, repo, { async start() { return "run"; } }); const headers = { authorization: "Bearer test-api-token" };
    expect((await app.inject({ method: "DELETE", url: `/v1/monitors/${monitor.id}`, headers })).statusCode).toBe(204);
    expect(await repo.getMonitor("tenant-a", monitor.id)).toBeNull(); expect(await repo.listFindings("tenant-a")).toHaveLength(1); await app.close();
  });
});
