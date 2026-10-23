import { loadConfig } from "./config.js";
import { SurrealRepository } from "./adapters/surreal-repository.js";
import { LlmFindingEvaluator } from "./adapters/evaluator.js";
import { ExaSearchAdapter } from "./adapters/exa-search.js";
import { MonitorExecutor } from "./services/executor.js";
export async function createExecutor() {
  const config = loadConfig(), repo = await SurrealRepository.connect(config);
  return { repo, executor: new MonitorExecutor(repo, new ExaSearchAdapter(config), new LlmFindingEvaluator(config)) };
}

