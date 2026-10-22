import { z } from "zod";

export const Priority = z.enum(["P1", "P2", "P3"]);
export const MockFixture = z.enum(["matching", "nonmatching", "duplicate", "changed", "failure"]);
export const SourceDefinition = z.discriminatedUnion("type", [
  z.object({ type: z.literal("mock"), key: z.string().min(1), fixture: MockFixture }),
]);

export const Organization = z.object({
  id: z.string(), name: z.string().min(1), context: z.string().default(""),
});
export type Organization = z.infer<typeof Organization>;

export const Monitor = z.object({
  id: z.string(), tenantId: z.string(), version: z.number().int().positive(),
  name: z.string().min(1), instructions: z.string().min(1), priority: Priority,
  enabled: z.boolean(), sources: z.array(SourceDefinition).min(1),
  memoryScope: z.string().min(1), context: z.string().default(""),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type Monitor = z.infer<typeof Monitor>;

export const ExecutionRecord = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), monitorVersion: z.number(),
  // New executions carry the exact monitor definition that was dispatched. The optional
  // field keeps previously persisted MVP executions readable during migration.
  monitorSnapshot: Monitor.optional(),
  renderRunId: z.string().optional(), status: z.enum(["queued", "running", "completed", "failed"]),
  createdAt: z.string().datetime(), startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(), error: z.string().optional(),
});
export type ExecutionRecord = z.infer<typeof ExecutionRecord>;

export const Observation = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), sourceType: z.string(),
  sourceKey: z.string(), externalId: z.string(), content: z.string(), sourceURL: z.string().url(),
  publishedAt: z.string().datetime(), observedAt: z.string().datetime(),
});
export type Observation = z.infer<typeof Observation>;

export const EvaluationResult = z.object({
  verdicts: z.array(z.object({
    verdict: z.enum(["match", "no_match", "insufficient_evidence"]),
    title: z.string().min(1), rationale: z.string().min(1),
    observationIds: z.array(z.string()),
  })).min(1),
});
export type EvaluationResult = z.infer<typeof EvaluationResult>;

export const Evaluation = z.object({
  id: z.string(), tenantId: z.string(), executionId: z.string(), monitorId: z.string(),
  monitorVersion: z.number(), observationIds: z.array(z.string()), contextReference: z.string(),
  result: EvaluationResult, createdAt: z.string().datetime(),
});
export type Evaluation = z.infer<typeof Evaluation>;

export const Finding = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), priority: Priority,
  title: z.string(), explanation: z.string(), observationIds: z.array(z.string()),
  createdAt: z.string().datetime(),
});
export type Finding = z.infer<typeof Finding>;

export const CreateMonitorInput = z.object({
  name: z.string().min(1), instructions: z.string().min(1), priority: Priority,
  enabled: z.boolean().default(true), sources: z.array(SourceDefinition).min(1),
  memoryScope: z.string().min(1).default("default"), context: z.string().default(""),
});
export const PatchMonitorInput = CreateMonitorInput.partial().refine((x) => Object.keys(x).length > 0);

