import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { createExecutor } from "./container.js";

export const runMonitor = task(
  { name: "runMonitor", retry: { maxRetries: 2, waitDurationMs: 1_000, backoffScaling: 2 }, timeoutSeconds: 300 },
  async (_ctx: TaskContext, executionId: string) => {
    const { repo, executor, posthog, posthogLogs } = await createExecutor();
    posthogLogs?.info("monitor execution started", { component: "workflow" });
    try {
      await executor.execute(executionId);
      posthogLogs?.info("monitor execution completed", { component: "workflow" });
      return { executionId, status: "completed" };
    }
    finally { await Promise.all([posthog?.shutdown(), posthogLogs?.shutdown(), repo.close()]); }
  },
);
