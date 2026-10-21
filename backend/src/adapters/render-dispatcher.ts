import { Render } from "@renderinc/sdk";
import type { WorkflowDispatcher } from "../ports.js";
export class RenderDispatcher implements WorkflowDispatcher {
  private render = new Render();
  constructor(private slug: string) {}
  async start(executionId: string) {
    const run = await this.render.workflows.startTask(`${this.slug}/runMonitor`, [executionId]);
    return run.taskRunId;
  }
}

