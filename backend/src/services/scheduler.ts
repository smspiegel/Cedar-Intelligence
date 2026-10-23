import type { Repository, WorkflowDispatcher } from "../ports.js";
import { MonitorService } from "./monitor-service.js";

export async function queueEnabledMonitors(repo: Repository, dispatcher: WorkflowDispatcher, date = new Date()) {
  const service = new MonitorService(repo, dispatcher);
  const slot = Math.floor(date.getTime() / (6 * 60 * 60 * 1000));
  const queued: string[] = [], skipped: string[] = [], failed: Array<{ monitorId: string; error: string }> = [];
  for (const monitor of await repo.listEnabledMonitors()) {
    if (await repo.hasActiveExecution(monitor.id)) { skipped.push(monitor.id); continue; }
    try { await service.run(monitor.tenantId, monitor.id, `schedule-${slot}`); queued.push(monitor.id); }
    catch (error) { failed.push({ monitorId: monitor.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  return { queued, skipped, failed };
}
