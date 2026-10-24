import type { EvaluationRecord, ExecutionRecord, Finding, FindingEvent, Observation, SearchResult } from "../domain.js";
import type { FindingEvaluator, Repository, SearchAdapter } from "../ports.js";
import { DisabledAgentMemory } from "../adapters/agent-memory.js";
import { FindingMemoryService } from "./finding-memory.js";
import { canonicalUrl, contentHash, errorMessage, newId, now, stableId } from "../utils.js";

export class MonitorExecutor {
  private memory: FindingMemoryService;
  constructor(private repo: Repository, private search: SearchAdapter, private evaluator: FindingEvaluator, memory?: FindingMemoryService) {
    this.memory = memory ?? new FindingMemoryService(repo, new DisabledAgentMemory());
  }
  async execute(executionId: string): Promise<void> {
    const execution = await this.findExecution(executionId);
    if (execution.status === "completed") return;
    const running: ExecutionRecord = { ...execution, status: "running", startedAt: execution.startedAt ?? now(), completedAt: undefined, error: undefined };
    let activeExecution = running;
    await this.repo.updateExecution(running);
    try {
      const monitor = execution.monitorSnapshot ?? await this.repo.getMonitor(execution.tenantId, execution.monitorId);
      if (!monitor) throw new Error("Monitor no longer exists");
      const unique = new Map<string, { query: string; result: SearchResult }>();
      for (const query of monitor.queries) for (const result of await this.search.search(query)) {
        const url = canonicalUrl(result.url); if (!unique.has(url)) unique.set(url, { query, result: { ...result } });
      }
      const recalled = await this.memory.recall(execution.tenantId, monitor, execution.id, [...unique.values()].map(item => item.result.title));
      const recentFindings = (await this.repo.listFindings(execution.tenantId, monitor.id)).slice(0, 20);
      const durableContext = recentFindings.map(finding => ({
        id: finding.id, title: finding.title, explanation: finding.explanation,
        workflowState: finding.workflowState, relevance: finding.relevance, updatedAt: finding.updatedAt,
      }));
      const history = [
        durableContext.length ? `Canonical Cedar finding state:\n${JSON.stringify(durableContext)}` : "",
        this.memory.mode === "assist" && recalled.text ? `Agent Memory recall:\n${recalled.text}` : "",
      ].filter(Boolean).join("\n\n").slice(0, 16_000);
      const contextualRunning: ExecutionRecord = {
        ...running, memoryStatus: recalled.status, memoryTraceId: recalled.traceId, memoryTier: recalled.tier,
        memoryHitCount: recalled.hitCount, memoryQueryMs: recalled.queryMs, memoryError: recalled.error,
      };
      activeExecution = contextualRunning;
      await this.repo.updateExecution(contextualRunning);
      const aiSessionId = `execution-${execution.id}`;
      let evaluatedCount = 0, findingsCreated = 0;
      for (const [url, item] of unique) {
        const revisionHash = contentHash(item.result.title, item.result.content, item.result.publishedAt);
        const observationId = stableId("observation", monitor.id, String(monitor.version), url, revisionHash);
        const candidate: Observation = {
          id: observationId, tenantId: monitor.tenantId, monitorId: monitor.id, executionId: execution.id, monitorVersion: monitor.version,
          query: item.query, canonicalUrl: url, sourceUrl: item.result.url, title: item.result.title, content: item.result.content,
          publishedAt: item.result.publishedAt, observedAt: now(), contentHash: revisionHash,
        };
        const created = await this.repo.putObservation(candidate);
        const observation = created ? candidate : await this.repo.getObservation(observationId);
        if (!observation || observation.processedAt) continue;
        const findingId = stableId("finding", monitor.id, url);
        const existing = await this.repo.getFinding(monitor.tenantId, findingId);
        const result = await this.evaluator.evaluate({ trigger: monitor.trigger, result: item.result, historicalContext: history, aiSessionId, aiTraceId: newId() });
        evaluatedCount += 1;
        const relationship = result.relationship ?? (existing ? "update" : "new");
        const evaluation: EvaluationRecord = {
          id: stableId("evaluation-record", execution.id, observationId), tenantId: monitor.tenantId, executionId: execution.id,
          monitorId: monitor.id, monitorVersion: monitor.version, observationId, matched: result.matched,
          title: result.title, reason: result.reason, relationship, memoryTraceId: recalled.traceId, createdAt: now(),
        };
        await this.repo.putEvaluation(evaluation);
        if (result.matched) {
          const timestamp = now();
          let previous = existing;
          let finding: Finding = existing
            ? { ...existing, bucket: monitor.bucket, title: result.title, explanation: result.reason, sourceUrl: url, observationId, version: existing.version + 1, updatedAt: timestamp }
            : { id: findingId, tenantId: monitor.tenantId, monitorId: monitor.id, bucket: monitor.bucket, title: result.title, explanation: result.reason, sourceUrl: url, observationId, workflowState: "unreviewed", relevance: "unknown", version: 1, createdAt: timestamp, updatedAt: timestamp };
          let stored = existing ? await this.repo.updateFindingIfVersion(finding, existing.version) : await this.repo.putFinding(finding);
          if (existing && !stored) {
            const latest = await this.repo.getFinding(monitor.tenantId, findingId);
            if (latest) {
              previous = latest;
              finding = { ...latest, bucket: monitor.bucket, title: result.title, explanation: result.reason, sourceUrl: url, observationId, version: latest.version + 1, updatedAt: timestamp };
              stored = await this.repo.updateFindingIfVersion(finding, latest.version);
            }
          }
          if (!stored) throw new Error("Finding changed while the monitor execution was updating it");
          if (!existing) findingsCreated += 1;
          const event: FindingEvent = {
            id: stableId("finding-event", evaluation.id), tenantId: finding.tenantId, monitorId: finding.monitorId,
            findingId: finding.id, type: existing ? "evidence_updated" : "created",
            previousWorkflowState: previous?.workflowState, workflowState: finding.workflowState,
            previousRelevance: previous?.relevance, relevance: finding.relevance, createdAt: timestamp,
          };
          await this.memory.recordEvent(finding, event, monitor);
        }
        await this.repo.markObservationProcessed(observationId, now());
      }
      await this.memory.flush(execution.tenantId, monitor.id);
      await this.repo.updateExecution({ ...contextualRunning, status: "completed", resultCount: unique.size, evaluatedCount, findingsCreated, completedAt: now() });
    } catch (error) {
      await this.repo.updateExecution({ ...activeExecution, status: "failed", completedAt: now(), error: errorMessage(error) });
      throw error;
    }
  }
  private async findExecution(id: string) { const execution = await this.repo.getExecutionInternal(id); if (!execution) throw new Error("Execution not found"); return execution; }
}
