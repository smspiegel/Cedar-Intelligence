import type { EvaluationRecord, ExecutionRecord, Finding, FindingEvent, MemoryOutboxEvent, Monitor, Observation } from "../domain.js";
import type { Repository } from "../ports.js";

export class InMemoryRepository implements Repository {
  monitors = new Map<string, Monitor>(); executions = new Map<string, ExecutionRecord>();
  observations = new Map<string, Observation>(); findings = new Map<string, Finding>();
  evaluations = new Map<string, EvaluationRecord>(); findingEvents = new Map<string, FindingEvent>();
  memoryOutbox = new Map<string, MemoryOutboxEvent>();
  async initialize() {} async ping() {} async close() {}
  async createMonitor(value: Monitor) { if (this.monitors.has(value.id)) throw new Error("Monitor already exists"); this.monitors.set(value.id, structuredClone(value)); }
  async getMonitor(tenantId: string, id: string) { const value = this.monitors.get(id); return value?.tenantId === tenantId && !value.deletedAt ? structuredClone(value) : null; }
  async listMonitors(tenantId: string) { return [...this.monitors.values()].filter(value => value.tenantId === tenantId && !value.deletedAt).map(value => structuredClone(value)); }
  async listEnabledMonitors() { return [...this.monitors.values()].filter(value => value.enabled && !value.deletedAt).map(value => structuredClone(value)); }
  async updateMonitorIfVersion(value: Monitor, expectedVersion: number) { const current = this.monitors.get(value.id); if (!current || current.version !== expectedVersion) return false; this.monitors.set(value.id, structuredClone(value)); return true; }
  async createExecution(value: ExecutionRecord) { if (this.executions.has(value.id)) throw new Error("Execution already exists"); this.executions.set(value.id, structuredClone(value)); }
  async getExecution(tenantId: string, id: string) { const value = this.executions.get(id); return value?.tenantId === tenantId ? structuredClone(value) : null; }
  async getExecutionInternal(id: string) { const value = this.executions.get(id); return value ? structuredClone(value) : null; }
  async listExecutions(tenantId: string, monitorId?: string, limit = 50) { return [...this.executions.values()].filter(value => value.tenantId === tenantId && (!monitorId || value.monitorId === monitorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(value => structuredClone(value)); }
  async hasActiveExecution(monitorId: string) { return [...this.executions.values()].some(value => value.monitorId === monitorId && (value.status === "queued" || value.status === "running")); }
  async updateExecution(value: ExecutionRecord) { this.executions.set(value.id, structuredClone(value)); }
  async setExecutionRenderRunId(id: string, renderRunId: string) { const value = this.executions.get(id); if (value) this.executions.set(id, { ...value, renderRunId }); }
  async putObservation(value: Observation) { if (this.observations.has(value.id)) return false; this.observations.set(value.id, structuredClone(value)); return true; }
  async getObservation(id: string) { const value = this.observations.get(id); return value ? structuredClone(value) : null; }
  async markObservationProcessed(id: string, processedAt: string) { const value = this.observations.get(id); if (value) this.observations.set(id, { ...value, processedAt }); }
  async putEvaluation(value: EvaluationRecord) { if (this.evaluations.has(value.id)) return false; this.evaluations.set(value.id, structuredClone(value)); return true; }
  async putFinding(value: Finding) { if (this.findings.has(value.id)) return false; this.findings.set(value.id, structuredClone(value)); return true; }
  async updateFindingIfVersion(value: Finding, expectedVersion: number) { const current = this.findings.get(value.id); if (!current || current.version !== expectedVersion) return false; this.findings.set(value.id, structuredClone(value)); return true; }
  async listFindings(tenantId: string, monitorId?: string) { return [...this.findings.values()].filter(value => value.tenantId === tenantId && (!monitorId || value.monitorId === monitorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(value => structuredClone(value)); }
  async countFindings(tenantId: string, monitorId: string) { return (await this.listFindings(tenantId, monitorId)).length; }
  async getFinding(tenantId: string, id: string) { const value = this.findings.get(id); return value?.tenantId === tenantId ? structuredClone(value) : null; }
  async putFindingEvent(value: FindingEvent) { if (this.findingEvents.has(value.id)) return false; this.findingEvents.set(value.id, structuredClone(value)); return true; }
  async getFindingEvent(id: string) { const value = this.findingEvents.get(id); return value ? structuredClone(value) : null; }
  async putFindingEventWithMemoryOutbox(value: FindingEvent, outbox?: MemoryOutboxEvent) { if (!this.findingEvents.has(value.id)) this.findingEvents.set(value.id, structuredClone(value)); if (outbox && !this.memoryOutbox.has(outbox.id)) this.memoryOutbox.set(outbox.id, structuredClone(outbox)); }
  async listFindingEvents(tenantId: string, findingId: string) { return [...this.findingEvents.values()].filter(value => value.tenantId === tenantId && value.findingId === findingId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(value => structuredClone(value)); }
  async putMemoryOutboxEvent(value: MemoryOutboxEvent) { if (this.memoryOutbox.has(value.id)) return false; this.memoryOutbox.set(value.id, structuredClone(value)); return true; }
  async listPendingMemoryOutboxEvents(tenantId: string, monitorId: string, limit = 50) { return [...this.memoryOutbox.values()].filter(value => value.tenantId === tenantId && value.monitorId === monitorId && value.status !== "synced").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, limit).map(value => structuredClone(value)); }
  async markMemoryOutboxSynced(id: string, updatedAt: string, memorySessionId?: string, memoryTurnId?: string) { const value = this.memoryOutbox.get(id); if (value) this.memoryOutbox.set(id, { ...value, status: "synced", updatedAt, memorySessionId, memoryTurnId, lastError: undefined }); }
  async markMemoryOutboxFailed(id: string, updatedAt: string, error: string) { const value = this.memoryOutbox.get(id); if (value) this.memoryOutbox.set(id, { ...value, status: "failed", attempts: value.attempts + 1, updatedAt, lastError: error }); }
  async getObservations(tenantId: string, ids: string[]) { const wanted = new Set(ids); return [...this.observations.values()].filter(value => value.tenantId === tenantId && wanted.has(value.id)).map(value => structuredClone(value)); }
}
