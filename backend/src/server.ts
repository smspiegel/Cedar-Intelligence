import { loadConfig } from "./config.js";
import { SurrealRepository } from "./adapters/surreal-repository.js";
import { RenderDispatcher } from "./adapters/render-dispatcher.js";
import { buildApp } from "./app.js";
import { createPostHog } from "./posthog.js";
import { createPostHogLogCapture } from "./posthog-logs.js";
const config = loadConfig(), repo = await SurrealRepository.connect(config), posthog = createPostHog(config), posthogLogs = createPostHogLogCapture(config);
await repo.initialize();
await repo.ping();
const app = buildApp(config, repo, new RenderDispatcher(config.RENDER_WORKFLOW_SLUG), posthog, posthogLogs);
await app.listen({ host: "0.0.0.0", port: config.PORT });
posthogLogs?.info("api server listening", { component: "api" });

