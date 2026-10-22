import type { Evaluation, ExecutionRecord, Finding, Observation } from "../domain.js";
import type { ContextProvider, FindingEvaluator, Repository } from "../ports.js";
import { collectMock } from "../adapters/mock-source.js";
import { errorMessage, now, stableId } from "../utils.js";

export class MonitorExecutor {
  constructor(private repo: Repository, private contexts: ContextProvider, private evaluator: FindingEvaluator) {}
  async execute(executionId: string): Promise<void> {
    const execution = await this.findExecution(executionId);
    if (execution.status === "completed") return;
    const running: ExecutionRecord = { ...execution, status: "running", startedAt: execution.startedAt ?? now() };
    await this.repo.updateExecution(running);
    try {
      // Executions are an audit boundary: once queued, changes to a monitor must not
      // change what that already-dispatched execution collects or evaluates.
      const monitor = execution.monitorSnapshot ?? await this.repo.getMonitor(execution.tenantId, execution.monitorId);
      if (!monitor) throw new Error("Monitor no longer exists");
      const org = await this.repo.getOrganization(execution.tenantId);
      if (!org) throw new Error("Organization context not found");
      const collected: Observation[] = [];
      for (const source of monitor.sources) {
        if (source.type === "mock") collected.push(...await collectMock(monitor, source));
      }
      for (const observation of collected) await this.repo.putObservation(observation);
      const context = await this.contexts.retrieve(org, monitor);
      const result = await this.evaluator.evaluate({ monitor, observations: collected, context: context.text });
      const cited = new Set(collected.map(o => o.id));
      for (const verdict of result.verdicts) if (verdict.observationIds.some(id => !cited.has(id))) throw new Error("Evaluation cited evidence outside this run");
      const evaluation: Evaluation = { id: stableId("evaluation", execution.id), tenantId: execution.tenantId, executionId: execution.id, monitorId: monitor.id, monitorVersion: execution.monitorVersion, observationIds: collected.map(o => o.id), contextReference: context.reference, result, createdAt: now() };
      await this.repo.putEvaluation(evaluation);
      for (const verdict of result.verdicts.filter(v => v.verdict === "match")) {
        if (verdict.observationIds.length === 0) throw new Error("A matching verdict must cite observations");
        const ids = [...verdict.observationIds].sort();
        const finding: Finding = { id: stableId("finding", monitor.id, String(execution.monitorVersion), verdict.title.trim().toLowerCase(), ...ids), tenantId: monitor.tenantId, monitorId: monitor.id, priority: monitor.priority, title: verdict.title, explanation: verdict.rationale, observationIds: ids, createdAt: now() };
        await this.repo.putFinding(finding);
      }
      await this.repo.updateExecution({ ...running, status: "completed", completedAt: now() });
    } catch (error) {
      await this.repo.updateExecution({ ...running, status: "failed", completedAt: now(), error: errorMessage(error) });
      throw error;
    }
  }
  private async findExecution(id: string) {
    // This internal lookup is available only to the trusted workflow, never an HTTP route.
    const execution = await this.repo.getExecutionInternal(id);
    if (!execution) throw new Error("Execution not found"); return execution;
  }
}
