import { CreateMonitorInput, PatchMonitorInput, type Monitor } from "../domain.js";
import type { Repository, WorkflowDispatcher } from "../ports.js";
import { newId, now, stableId } from "../utils.js";

export class MonitorService {
  constructor(private repo: Repository, private dispatcher: WorkflowDispatcher) {}
  async create(tenantId: string, raw: unknown) {
    const input = CreateMonitorInput.parse(raw), timestamp = now();
    const monitor: Monitor = { ...input, id: newId(), tenantId, version: 1, createdAt: timestamp, updatedAt: timestamp };
    await this.repo.createMonitor(monitor); return monitor;
  }
  list(tenantId: string) { return this.repo.listMonitors(tenantId); }
  async patch(tenantId: string, id: string, raw: unknown, expectedVersion?: number) {
    const current = await this.repo.getMonitor(tenantId, id); if (!current) return null;
    if (expectedVersion !== undefined && current.version !== expectedVersion) throw new MonitorRunError(409, "Monitor has changed; refresh before saving");
    const patch = PatchMonitorInput.parse(raw); const next = { ...current, ...patch, version: current.version + 1, updatedAt: now() };
    if (!await this.repo.updateMonitorIfVersion(next, current.version)) throw new MonitorRunError(409, "Monitor has changed; refresh before saving");
    return next;
  }
  async run(tenantId: string, id: string, idempotencyKey?: string) {
    const monitor = await this.repo.getMonitor(tenantId, id);
    if (!monitor) throw new MonitorRunError(404, "Monitor not found");
    if (!monitor.enabled) throw new MonitorRunError(409, "Monitor is disabled");
    const executionId = idempotencyKey ? stableId("execution", tenantId, id, idempotencyKey) : newId();
    if (idempotencyKey) {
      const existing = await this.repo.getExecution(tenantId, executionId);
      if (existing) return existing;
    }
    const execution = {
      id: executionId, tenantId, monitorId: id, monitorVersion: monitor.version,
      monitorSnapshot: structuredClone(monitor), status: "queued" as const, createdAt: now(),
    };
    try { await this.repo.createExecution(execution); }
    catch (error) {
      if (idempotencyKey) {
        const existing = await this.repo.getExecution(tenantId, executionId);
        if (existing) return existing;
      }
      throw error;
    }
    try { const renderRunId = await this.dispatcher.start(execution.id); await this.repo.updateExecution({ ...execution, renderRunId }); return { ...execution, renderRunId }; }
    catch (error) { await this.repo.updateExecution({ ...execution, status: "failed", completedAt: now(), error: error instanceof Error ? error.message : String(error) }); throw error; }
  }
}
export class MonitorRunError extends Error { constructor(public statusCode: number, message: string) { super(message); } }
