import { AgentMemory } from "@surrealdb/memory";
import type { AppConfig } from "../config.js";
import type { ContextProvider } from "../ports.js";

export class ContextService implements ContextProvider {
  private client?: AgentMemory;
  constructor(private config: AppConfig) {
    const values = [config.AGENT_MEMORY_ENDPOINT, config.AGENT_MEMORY_CONTEXT, config.AGENT_MEMORY_API_KEY];
    if (values.some(Boolean) && !values.every(Boolean)) throw new Error("Agent Memory requires endpoint, context, and API key together");
    if (values.every(Boolean)) this.client = new AgentMemory({ endpoint: values[0]!, context: values[1]!, apiKey: values[2]! });
  }
  async retrieve(org: Parameters<ContextProvider["retrieve"]>[0], monitor: Parameters<ContextProvider["retrieve"]>[1]) {
    const seeded = [org.context, monitor.context, this.config.SEEDED_CONTEXT].filter(Boolean).join("\n");
    if (!this.client) return { text: seeded, reference: "seeded-context" };
    // Retrieval errors deliberately propagate: configured memory is authoritative, not an optional fallback.
    const result = await this.client.context(`${monitor.name}: ${monitor.instructions}`, { k: 10, lens: [monitor.memoryScope] });
    return { text: [seeded, result.context].filter(Boolean).join("\n"), reference: `agent-memory:${result.tier}` };
  }
}
