import { loadConfig } from "../src/config.js";
import { SurrealRepository } from "../src/adapters/surreal-repository.js";
import { MonitorService } from "../src/services/monitor-service.js";
const config = loadConfig(), repo = await SurrealRepository.connect(config);
await repo.putOrganization({ id: config.TENANT_ID, name: "Cedar Demo", context: "Acme is a tracked strategic competitor." });
const service = new MonitorService(repo, { async start() { throw new Error("seed does not dispatch"); } });
if ((await repo.listMonitors(config.TENANT_ID)).length === 0) await service.create(config.TENANT_ID, {
  name: "Competitor launch monitor", instructions: "Match announcements that Acme launched Project Birch.",
  priority: "P2", enabled: true, sources: [{ type: "mock", key: "demo-feed", fixture: "matching" }],
  memoryScope: `org/${config.TENANT_ID}`, context: "Toronto launches are especially relevant.",
});
await repo.close(); console.log("Seeded demo organization and monitor");
