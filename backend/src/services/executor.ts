import type { ExecutionRecord, Finding, Observation, SearchResult } from "../domain.js";
import type { FindingEvaluator, Repository, SearchAdapter } from "../ports.js";
import { canonicalUrl, errorMessage, now, stableId } from "../utils.js";

export class MonitorExecutor {
  constructor(private repo: Repository, private search: SearchAdapter, private evaluator: FindingEvaluator) {}
  async execute(executionId: string): Promise<void> {
    const execution = await this.findExecution(executionId);
    if (execution.status === "completed") return;
    const running: ExecutionRecord = { ...execution, status: "running", startedAt: execution.startedAt ?? now(), completedAt: undefined, error: undefined };
    await this.repo.updateExecution(running);
    try {
      const monitor = execution.monitorSnapshot ?? await this.repo.getMonitor(execution.tenantId, execution.monitorId);
      if (!monitor) throw new Error("Monitor no longer exists");
      const unique = new Map<string, { query: string; result: SearchResult }>();
      for (const query of monitor.queries) for (const result of await this.search.search(query)) {
        const url = canonicalUrl(result.url); if (!unique.has(url)) unique.set(url, { query, result: { ...result, url } });
      }
      let evaluatedCount = 0, findingsCreated = 0;
      for (const [url, item] of unique) {
        const observationId = stableId("observation", monitor.id, url);
        const candidate: Observation = { id: observationId, tenantId: monitor.tenantId, monitorId: monitor.id, query: item.query, canonicalUrl: url, sourceUrl: item.result.url, title: item.result.title, content: item.result.content, publishedAt: item.result.publishedAt, observedAt: now() };
        const created = await this.repo.putObservation(candidate);
        const observation = created ? candidate : await this.repo.getObservation(observationId);
        if (!observation || observation.processedAt) continue;
        const result = await this.evaluator.evaluate({ trigger: monitor.trigger, result: item.result });
        evaluatedCount += 1;
        if (result.matched) {
          const finding: Finding = { id: stableId("finding", monitor.id, url), tenantId: monitor.tenantId, monitorId: monitor.id, bucket: monitor.bucket, title: result.title, explanation: result.reason, sourceUrl: item.result.url, observationId, createdAt: now() };
          if (await this.repo.putFinding(finding)) findingsCreated += 1;
        }
        await this.repo.markObservationProcessed(observationId, now());
      }
      await this.repo.updateExecution({ ...running, status: "completed", resultCount: unique.size, evaluatedCount, findingsCreated, completedAt: now() });
    } catch (error) {
      await this.repo.updateExecution({ ...running, status: "failed", completedAt: now(), error: errorMessage(error) });
      throw error;
    }
  }
  private async findExecution(id: string) { const execution = await this.repo.getExecutionInternal(id); if (!execution) throw new Error("Execution not found"); return execution; }
}
