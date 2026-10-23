import { loadConfig } from "../src/config.js";
import { SurrealRepository } from "../src/adapters/surreal-repository.js";
import { RenderDispatcher } from "../src/adapters/render-dispatcher.js";
import { queueEnabledMonitors } from "../src/services/scheduler.js";

const config = loadConfig(), repo = await SurrealRepository.connect(config);
try {
  const result = await queueEnabledMonitors(repo, new RenderDispatcher(config.RENDER_WORKFLOW_SLUG));
  console.log(JSON.stringify(result));
  if (result.failed.length) process.exitCode = 1;
} finally { await repo.close(); }
