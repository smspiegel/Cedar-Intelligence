import { AgentMemory } from "@surrealdb/memory";
import type { AppConfig } from "../config.js";
import type { AgentMemoryPort, MemoryRecallResult } from "../ports.js";
import type { MemoryOutboxEvent } from "../domain.js";
import { errorMessage } from "../utils.js";

const scopeSegment = (value: string) => encodeURIComponent(value.replaceAll("/", "_"));
export const monitorMemoryScope = (tenantId: string, monitorId: string) => `org/${scopeSegment(tenantId)}/monitor/${scopeSegment(monitorId)}`;

export class DisabledAgentMemory implements AgentMemoryPort {
  readonly mode = "off" as const;
  async recall(): Promise<MemoryRecallResult> { return { status: "disabled", text: "", hitCount: 0 }; }
  async remember() { return {}; }
}

export class SurrealAgentMemory implements AgentMemoryPort {
  readonly mode: "shadow" | "assist";
  private client: AgentMemory;
  private registeredScopes = new Set<string>();
  constructor(private config: AppConfig) {
    if (config.AGENT_MEMORY_MODE === "off" || !config.AGENT_MEMORY_ENDPOINT || !config.AGENT_MEMORY_CONTEXT || !config.AGENT_MEMORY_API_KEY) {
      throw new Error("SurrealAgentMemory requires enabled Agent Memory configuration");
    }
    this.mode = config.AGENT_MEMORY_MODE;
    this.client = new AgentMemory({
      endpoint: config.AGENT_MEMORY_ENDPOINT, context: config.AGENT_MEMORY_CONTEXT, apiKey: config.AGENT_MEMORY_API_KEY,
      timeoutMs: 10_000, maxRetries: 2,
    });
  }
  private tenantClient(tenantId: string) {
    return this.config.AGENT_MEMORY_PRINCIPAL_PREFIX
      ? this.client.onBehalfOf(`${this.config.AGENT_MEMORY_PRINCIPAL_PREFIX}${tenantId}`)
      : this.client;
  }
  private async ensureMonitorScope(tenantId: string, monitorId: string) {
    const path = monitorMemoryScope(tenantId, monitorId);
    if (this.registeredScopes.has(path)) return path;
    await this.tenantClient(tenantId).scopes.register({
      path,
      displayName: `Cedar monitor ${monitorId}`,
      description: `Durable findings and review decisions for Cedar monitor ${monitorId}`,
    });
    this.registeredScopes.add(path);
    return path;
  }
  async recall(input: Parameters<AgentMemoryPort["recall"]>[0]): Promise<MemoryRecallResult> {
    const query = [
      `Recall prior findings, human review decisions, false positives, resolved items, and recurring developments relevant to this monitor.`,
      `Monitor: ${input.monitor.name}. Trigger: ${input.monitor.trigger}.`,
      input.candidateTitles.length ? `Current candidate titles: ${input.candidateTitles.slice(0, 20).join(" | ")}` : "",
    ].filter(Boolean).join("\n");
    try {
      const scope = await this.ensureMonitorScope(input.tenantId, input.monitor.id);
      const result = await this.tenantClient(input.tenantId).recall(query, {
        k: 12, lens: [scope],
        include: ["facts", "passages"], source: `cedar-monitor-execution:${input.executionId}`,
      });
      const hits = result.hits.slice(0, 12);
      const text = hits.map(hit => `- [${hit.source}:${hit.id}] ${hit.text}`).join("\n").slice(0, 12_000);
      return {
        status: hits.length ? "recalled" : "empty", text, hitCount: hits.length,
        traceId: result.trace.traceId, tier: result.tier, queryMs: result.queryMs,
      };
    } catch (error) {
      return { status: "unavailable", text: "", hitCount: 0, error: errorMessage(error) };
    }
  }
  async remember(event: MemoryOutboxEvent) {
    const scope = await this.ensureMonitorScope(event.tenantId, event.monitorId);
    const result = await this.tenantClient(event.tenantId).remember(event.text, {
      infer: "full", scopes: [scope],
      role: event.labels.includes("actor=human") ? "user" : "assistant", labels: event.labels,
      memoryCategory: "knowledge",
    });
    return { sessionId: result.sessionId, turnId: result.turnId };
  }
}

export const createAgentMemory = (config: AppConfig): AgentMemoryPort => config.AGENT_MEMORY_MODE === "off"
  ? new DisabledAgentMemory()
  : new SurrealAgentMemory(config);
