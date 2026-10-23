import { loadConfig } from "../src/config.js";
import { SurrealRepository } from "../src/adapters/surreal-repository.js";
import { MonitorService } from "../src/services/monitor-service.js";
const config = loadConfig(), repo = await SurrealRepository.connect(config);
const service = new MonitorService(repo, { async start() { throw new Error("seed does not dispatch"); } });
if ((await repo.listMonitors(config.TENANT_ID)).length === 0) await service.create(config.TENANT_ID, {
  name: "Competitor launch monitor", queries: ["enterprise AI product launches", "AI governance launch"],
  trigger: "A competitor announces a new enterprise AI product or major feature.", bucket: "flag", enabled: true,
});
await repo.close(); console.log("Seeded demo monitor");
