import { CreateMonitorInput, PatchMonitorInput, type ExecutionRecord, type Monitor } from "../domain.js";
import type { Repository, WorkflowDispatcher } from "../ports.js";
import { errorMessage, newId, now, stableId } from "../utils.js";

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
  async remove(tenantId: string, id: string) {
    const current = await this.repo.getMonitor(tenantId, id); if (!current) return false;
    const timestamp = now();
    const archived: Monitor = { ...current, enabled: false, deletedAt: timestamp, updatedAt: timestamp, version: current.version + 1 };
    if (!await this.repo.updateMonitorIfVersion(archived, current.version)) throw new MonitorRunError(409, "Monitor has changed; refresh before deleting");
    return true;
  }
  async run(tenantId: string, id: string, idempotencyKey?: string) {
    const monitor = await this.repo.getMonitor(tenantId, id);
    if (!monitor) throw new MonitorRunError(404, "Monitor not found");
    if (!monitor.enabled) throw new MonitorRunError(409, "Monitor is disabled");
    const executionId = idempotencyKey ? stableId("execution", tenantId, id, idempotencyKey) : newId();
    if (idempotencyKey) { const existing = await this.repo.getExecution(tenantId, executionId); if (existing) return existing; }
    const execution: ExecutionRecord = { id: executionId, tenantId, monitorId: id, monitorVersion: monitor.version, monitorSnapshot: structuredClone(monitor), status: "queued", createdAt: now() };
    try { await this.repo.createExecution(execution); }
    catch (error) { if (idempotencyKey) { const existing = await this.repo.getExecution(tenantId, executionId); if (existing) return existing; } throw error; }
    try {
      const renderRunId = await this.dispatcher.start(execution.id);
      await this.repo.setExecutionRenderRunId(execution.id, renderRunId);
      return { ...execution, renderRunId };
    } catch (error) {
      const latest = await this.repo.getExecution(tenantId, execution.id);
      const dispatchError = `Workflow dispatch failed: ${errorMessage(error)}`;
      if (latest && latest.status !== "completed") await this.repo.updateExecution({ ...latest, status: "failed", completedAt: now(), error: dispatchError });
      throw new MonitorRunError(503, "The workflow runner is unavailable, so the monitor could not start. Start the local workflow runner with `npm run workflow:dev` and try again.", "WORKFLOW_UNAVAILABLE");
    }
  }
}
export class MonitorRunError extends Error {
  constructor(public statusCode: number, message: string, public code = "MONITOR_RUN_FAILED") { super(message); }
}
