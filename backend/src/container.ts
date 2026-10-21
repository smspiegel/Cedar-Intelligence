import { loadConfig } from "./config.js";
import { SurrealRepository } from "./adapters/surreal-repository.js";
import { ContextService } from "./adapters/context.js";
import { LlmFindingEvaluator } from "./adapters/evaluator.js";
import { MonitorExecutor } from "./services/executor.js";
export async function createExecutor() {
  const config = loadConfig(), repo = await SurrealRepository.connect(config);
  return { repo, executor: new MonitorExecutor(repo, new ContextService(config), new LlmFindingEvaluator(config)) };
}

