import type { Evaluation, ExecutionRecord, Finding, Monitor, Observation, Organization } from "../domain.js";
import type { Repository } from "../ports.js";

export class InMemoryRepository implements Repository {
  organizations = new Map<string, Organization>(); monitors = new Map<string, Monitor>();
  executions = new Map<string, ExecutionRecord>(); observations = new Map<string, Observation>();
  evaluations = new Map<string, Evaluation>(); findings = new Map<string, Finding>();
  async initialize() {} async close() {}
  async getOrganization(id: string) { return this.organizations.get(id) ?? null; }
  async putOrganization(v: Organization) { this.organizations.set(v.id, structuredClone(v)); }
  async createMonitor(v: Monitor) { this.monitors.set(v.id, structuredClone(v)); }
  async getMonitor(t: string, id: string) { const v = this.monitors.get(id); return v?.tenantId === t ? structuredClone(v) : null; }
  async listMonitors(t: string) { return [...this.monitors.values()].filter(v => v.tenantId === t).map(v => structuredClone(v)); }
  async updateMonitor(v: Monitor) { this.monitors.set(v.id, structuredClone(v)); }
  async createExecution(v: ExecutionRecord) { this.executions.set(v.id, structuredClone(v)); }
  async getExecution(t: string, id: string) { const v = this.executions.get(id); return v?.tenantId === t ? structuredClone(v) : null; }
  async getExecutionInternal(id: string) { const v = this.executions.get(id); return v ? structuredClone(v) : null; }
  async updateExecution(v: ExecutionRecord) { this.executions.set(v.id, structuredClone(v)); }
  async putObservation(v: Observation) { if (this.observations.has(v.id)) return false; this.observations.set(v.id, structuredClone(v)); return true; }
  async putEvaluation(v: Evaluation) { this.evaluations.set(v.id, structuredClone(v)); }
  async putFinding(v: Finding) { if (this.findings.has(v.id)) return false; this.findings.set(v.id, structuredClone(v)); return true; }
  async listFindings(t: string, m?: string) { return [...this.findings.values()].filter(v => v.tenantId === t && (!m || v.monitorId === m)).map(v => structuredClone(v)); }
}
