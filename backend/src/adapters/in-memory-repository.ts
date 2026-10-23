import type { ExecutionRecord, Finding, Monitor, Observation } from "../domain.js";
import type { Repository } from "../ports.js";

export class InMemoryRepository implements Repository {
  monitors = new Map<string, Monitor>(); executions = new Map<string, ExecutionRecord>();
  observations = new Map<string, Observation>(); findings = new Map<string, Finding>();
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
  async putFinding(value: Finding) { if (this.findings.has(value.id)) return false; this.findings.set(value.id, structuredClone(value)); return true; }
  async listFindings(tenantId: string, monitorId?: string) { return [...this.findings.values()].filter(value => value.tenantId === tenantId && (!monitorId || value.monitorId === monitorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(value => structuredClone(value)); }
  async countFindings(tenantId: string, monitorId: string) { return (await this.listFindings(tenantId, monitorId)).length; }
  async getFinding(tenantId: string, id: string) { const value = this.findings.get(id); return value?.tenantId === tenantId ? structuredClone(value) : null; }
  async getObservations(tenantId: string, ids: string[]) { const wanted = new Set(ids); return [...this.observations.values()].filter(value => value.tenantId === tenantId && wanted.has(value.id)).map(value => structuredClone(value)); }
}
