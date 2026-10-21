import { loadConfig } from "./config.js";
import { SurrealRepository } from "./adapters/surreal-repository.js";
import { RenderDispatcher } from "./adapters/render-dispatcher.js";
import { buildApp } from "./app.js";
const config = loadConfig(), repo = await SurrealRepository.connect(config); await repo.initialize();
const app = buildApp(config, repo, new RenderDispatcher(config.RENDER_WORKFLOW_SLUG));
await app.listen({ host: "0.0.0.0", port: config.PORT });

