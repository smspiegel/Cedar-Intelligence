import fixtures from "../../fixtures/mock-observations.json" with { type: "json" };
import type { Monitor, Observation } from "../domain.js";
import { now, stableId } from "../utils.js";

type Row = { externalId: string; content: string; sourceURL: string; publishedAt: string };
export async function collectMock(monitor: Monitor, source: Extract<Monitor["sources"][number], { type: "mock" }>): Promise<Observation[]> {
  if (source.fixture === "failure") throw new Error(`Mock source ${source.key} failed as requested`);
  const rows = fixtures[source.fixture] as Row[];
  return rows.map(row => ({
    id: stableId(monitor.tenantId, monitor.id, source.type, source.key, row.externalId, row.content),
    tenantId: monitor.tenantId, monitorId: monitor.id, sourceType: source.type, sourceKey: source.key,
    ...row, observedAt: now(),
  }));
}

