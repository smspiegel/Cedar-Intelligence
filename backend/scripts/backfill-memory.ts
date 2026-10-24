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
    if (!finding || (await repo.listFindingEvents(row.tenantId, finding.id)).length > 0) continue;
    const event: FindingEvent = {
      id: stableId("finding-event", "memory-backfill", finding.id), tenantId: finding.tenantId,
      monitorId: finding.monitorId, findingId: finding.id, type: "created",
      workflowState: finding.workflowState, relevance: finding.relevance,
      note: "Historical finding imported into Agent Memory.", createdAt: finding.updatedAt,
    };
    await memory.recordEvent(finding, event);
    scopes.add(`${finding.tenantId}\u0000${finding.monitorId}`);
    queued += 1;
  }

  for (const scope of scopes) {
    const [tenantId, monitorId] = scope.split("\u0000");
    await memory.flush(tenantId, monitorId);
  }
  console.log(`Backfilled ${queued} historical findings across ${scopes.size} monitor scopes`);
} finally {
  await repo.close();
}
