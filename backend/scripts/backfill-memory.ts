import { loadConfig } from "../src/config.js";
import { createAgentMemory } from "../src/adapters/agent-memory.js";
import { connectSurreal } from "../src/adapters/surreal-connection.js";
import { SurrealRepository } from "../src/adapters/surreal-repository.js";
import type { FindingEvent } from "../src/domain.js";
import { FindingMemoryService } from "../src/services/finding-memory.js";
import { stableId } from "../src/utils.js";

const config = loadConfig();
if (config.AGENT_MEMORY_MODE === "off") throw new Error("Set AGENT_MEMORY_MODE=shadow or assist before backfilling Agent Memory");

const db = await connectSurreal(config);
const repo = new SurrealRepository(db, config);
const memory = new FindingMemoryService(repo, createAgentMemory(config));

try {
  const [rows] = await db.query<[Array<{ key: string; tenantId: string }>]>("SELECT key, tenantId FROM finding ORDER BY createdAt");
  const scopes = new Set<string>();
  let queued = 0;

  for (const row of rows) {
    const finding = await repo.getFinding(row.tenantId, row.key);
    if (!finding) continue;
    const existingEvents = await repo.listFindingEvents(row.tenantId, finding.id);
    const events: FindingEvent[] = existingEvents.length ? existingEvents : [{
      id: stableId("finding-event", "memory-backfill", finding.id), tenantId: finding.tenantId,
      monitorId: finding.monitorId, findingId: finding.id, type: "created",
      workflowState: finding.workflowState, relevance: finding.relevance,
      note: "Historical finding imported into Agent Memory.", createdAt: finding.updatedAt,
    }];
    const monitor = await repo.getMonitor(finding.tenantId, finding.monitorId) ?? undefined;
    for (const event of events) await memory.recordEvent(finding, event, monitor);
    scopes.add(`${finding.tenantId}\u0000${finding.monitorId}`);
    queued += events.length;
  }

  for (const scope of scopes) {
    const [tenantId, monitorId] = scope.split("\u0000");
    await memory.flush(tenantId, monitorId);
  }
  console.log(`Projected ${queued} historical finding events across ${scopes.size} monitor scopes`);
} finally {
  await repo.close();
}
