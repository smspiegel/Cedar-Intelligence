import type { Finding, FindingEvent, MemoryOutboxEvent, Monitor } from "../domain.js";
import type { AgentMemoryPort, Repository } from "../ports.js";
import { errorMessage, now, stableId } from "../utils.js";

export class FindingMemoryService {
  constructor(private repo: Repository, private memory: AgentMemoryPort) {}
  get mode() { return this.memory.mode; }

  async recall(tenantId: string, monitor: Monitor, executionId: string, candidateTitles: string[]) {
    await this.flush(tenantId, monitor.id);
    return this.memory.recall({ tenantId, monitor, executionId, candidateTitles });
  }

  async recordEvent(finding: Finding, event: FindingEvent, monitor?: Monitor) {
    if (this.memory.mode === "off") { await this.repo.putFindingEventWithMemoryOutbox(event); return; }
    const timestamp = now();
    const outbox: MemoryOutboxEvent = {
      id: stableId("memory-outbox", event.id), tenantId: event.tenantId, monitorId: event.monitorId,
      findingId: event.findingId, findingEventId: event.id,
      text: this.eventText(finding, event, monitor),
      labels: [`finding=${finding.id}`, `event=${event.type}`, event.actorId ? "actor=human" : "actor=cedar"],
      status: "pending", attempts: 0, createdAt: timestamp, updatedAt: timestamp,
    };
    await this.repo.putFindingEventWithMemoryOutbox(event, outbox);
  }

  async flush(tenantId: string, monitorId: string) {
    if (this.memory.mode === "off") return;
    for (const event of await this.repo.listPendingMemoryOutboxEvents(tenantId, monitorId, 50)) {
      try {
        const receipt = await this.memory.remember(event);
        await this.repo.markMemoryOutboxSynced(event.id, now(), receipt.sessionId, receipt.turnId);
      } catch (error) {
        await this.repo.markMemoryOutboxFailed(event.id, now(), errorMessage(error).slice(0, 1000));
      }
    }
  }

  private eventText(finding: Finding, event: FindingEvent, monitor?: Monitor) {
    const parts = [
      `Cedar finding ${finding.id} for monitor ${monitor?.name ?? finding.monitorId}.`,
      monitor ? `The monitor trigger is: ${monitor.trigger}` : "",
      `Finding title: ${finding.title}. Cedar's explanation: ${finding.explanation}`,
      `Classification bucket: ${finding.bucket}. Source: ${finding.sourceUrl}.`,
      `At ${event.createdAt}, the finding event was ${event.type}. Workflow state is ${event.workflowState}; relevance is ${event.relevance}.`,
      event.note ? `Human note: ${event.note}` : "",
      event.actorId ? `The decision was recorded by Cedar user ${event.actorId}.` : "The event was recorded by the Cedar monitor.",
    ];
    return parts.filter(Boolean).join("\n");
  }
}
