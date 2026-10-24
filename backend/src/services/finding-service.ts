import { CreateFindingEventInput, type FindingEvent } from "../domain.js";
import type { Repository } from "../ports.js";
import { FindingMemoryService } from "./finding-memory.js";
import { newId, now, stableId } from "../utils.js";

export class FindingUpdateError extends Error {
  constructor(public statusCode: number, message: string, public code = "FINDING_UPDATE_FAILED") { super(message); }
}

export class FindingService {
  constructor(private repo: Repository, private memory: FindingMemoryService) {}

  async record(tenantId: string, actorId: string | undefined, findingId: string, raw: unknown, expectedVersion: number, idempotencyKey?: string) {
    const input = CreateFindingEventInput.parse(raw);
    const current = await this.repo.getFinding(tenantId, findingId);
    if (!current) throw new FindingUpdateError(404, "Finding not found", "NOT_FOUND");
    const eventId = idempotencyKey ? stableId("finding-event", tenantId, findingId, idempotencyKey) : newId();
    const priorEvent = idempotencyKey ? await this.repo.getFindingEvent(eventId) : null;
    if (priorEvent?.tenantId === tenantId && priorEvent.findingId === findingId) return { finding: current, event: priorEvent };
    if (current.version !== expectedVersion) throw new FindingUpdateError(409, "Finding has changed; refresh before updating", "VERSION_CONFLICT");
    const timestamp = now();
    const next = {
      ...current,
      workflowState: input.workflowState ?? current.workflowState,
      relevance: input.relevance ?? current.relevance,
      version: current.version + 1,
      updatedAt: timestamp,
    };
    if (!await this.repo.updateFindingIfVersion(next, current.version)) throw new FindingUpdateError(409, "Finding has changed; refresh before updating", "VERSION_CONFLICT");
    const event: FindingEvent = {
      id: eventId,
      tenantId, monitorId: current.monitorId, findingId, type: input.workflowState || input.relevance ? "reviewed" : "note_added",
      previousWorkflowState: current.workflowState, workflowState: next.workflowState,
      previousRelevance: current.relevance, relevance: next.relevance,
      note: input.note, actorId, createdAt: timestamp,
    };
    await this.memory.recordEvent(next, event);
    await this.memory.flush(tenantId, current.monitorId);
    return { finding: next, event };
  }
}
