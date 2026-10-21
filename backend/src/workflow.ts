import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { createExecutor } from "./container.js";

export const runMonitor = task(
  { name: "runMonitor", retry: { maxRetries: 2, waitDurationMs: 1_000, backoffScaling: 2 }, timeoutSeconds: 300 },
  async (_ctx: TaskContext, executionId: string) => {
    const { repo, executor } = await createExecutor();
    try { await executor.execute(executionId); return { executionId, status: "completed" }; }
    finally { await repo.close(); }
  },
);
