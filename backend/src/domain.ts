import { z } from "zod";

const trimmed = z.string().trim().min(1);
export const Bucket = z.enum(["threat", "flag", "opportunity"]);
export type Bucket = z.infer<typeof Bucket>;

export const Monitor = z.object({
  id: z.string(), tenantId: z.string(), version: z.number().int().positive(),
  name: trimmed, queries: z.array(trimmed).min(1).max(5), trigger: trimmed,
  bucket: Bucket, enabled: z.boolean(), deletedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type Monitor = z.infer<typeof Monitor>;

export const SearchResult = z.object({
  url: z.string().url(), title: trimmed, content: z.string(),
  publishedAt: z.string().datetime().nullable().optional(),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const EvaluationResult = z.object({
  matched: z.boolean(), title: trimmed, reason: trimmed,
  relationship: z.enum(["new", "update", "recurrence", "unchanged"]).optional(),
});
export type EvaluationResult = z.infer<typeof EvaluationResult>;

export const FindingRelationship = z.enum(["new", "update", "recurrence", "unchanged"]);
export type FindingRelationship = z.infer<typeof FindingRelationship>;
export const FindingWorkflowState = z.enum(["unreviewed", "monitoring", "action_underway", "resolved", "dismissed"]);
export type FindingWorkflowState = z.infer<typeof FindingWorkflowState>;
export const FindingRelevance = z.enum(["unknown", "confirmed", "false_positive"]);
export type FindingRelevance = z.infer<typeof FindingRelevance>;

export const EvaluationRecord = z.object({
  id: z.string(), tenantId: z.string(), executionId: z.string(), monitorId: z.string(), monitorVersion: z.number(),
  observationId: z.string(), matched: z.boolean(), title: trimmed, reason: trimmed,
  relationship: FindingRelationship, memoryTraceId: z.string().optional(), createdAt: z.string().datetime(),
});
export type EvaluationRecord = z.infer<typeof EvaluationRecord>;

export const ExecutionRecord = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), monitorVersion: z.number(),
  monitorSnapshot: Monitor.optional(), renderRunId: z.string().optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  resultCount: z.number().int().nonnegative().optional(), evaluatedCount: z.number().int().nonnegative().optional(),
  findingsCreated: z.number().int().nonnegative().optional(), createdAt: z.string().datetime(),
  memoryStatus: z.enum(["disabled", "empty", "recalled", "unavailable"]).optional(),
  memoryTraceId: z.string().optional(), memoryTier: z.string().optional(), memoryHitCount: z.number().int().nonnegative().optional(),
  memoryQueryMs: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime().optional(), completedAt: z.string().datetime().optional(), error: z.string().optional(),
});
export type ExecutionRecord = z.infer<typeof ExecutionRecord>;

export const Observation = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), query: z.string(),
  canonicalUrl: z.string().url(), sourceUrl: z.string().url(), title: z.string(), content: z.string(),
  publishedAt: z.string().datetime().nullable().optional(), observedAt: z.string().datetime(),
  executionId: z.string().optional(), monitorVersion: z.number().int().positive().optional(), contentHash: z.string().optional(),
  processedAt: z.string().datetime().optional(),
});
export type Observation = z.infer<typeof Observation>;

export const Finding = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), bucket: Bucket,
  title: trimmed, explanation: trimmed, sourceUrl: z.string().url(), observationId: z.string(),
  workflowState: FindingWorkflowState, relevance: FindingRelevance, version: z.number().int().positive(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});
export type Finding = z.infer<typeof Finding>;

export const FindingEventType = z.enum(["created", "evidence_updated", "reviewed", "note_added"]);
export type FindingEventType = z.infer<typeof FindingEventType>;
export const FindingEvent = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), findingId: z.string(), type: FindingEventType,
  previousWorkflowState: FindingWorkflowState.optional(), workflowState: FindingWorkflowState,
  previousRelevance: FindingRelevance.optional(), relevance: FindingRelevance,
  note: z.string().trim().max(2000).optional(), actorId: z.string().optional(), createdAt: z.string().datetime(),
});
export type FindingEvent = z.infer<typeof FindingEvent>;

export const MemoryOutboxEvent = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), findingId: z.string(), findingEventId: z.string(),
  text: trimmed, labels: z.array(z.string()), status: z.enum(["pending", "synced", "failed"]), attempts: z.number().int().nonnegative(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), lastError: z.string().optional(),
  memorySessionId: z.string().optional(), memoryTurnId: z.string().optional(),
});
export type MemoryOutboxEvent = z.infer<typeof MemoryOutboxEvent>;

export const CreateFindingEventInput = z.object({
  workflowState: FindingWorkflowState.optional(), relevance: FindingRelevance.optional(), note: z.string().trim().min(1).max(2000).optional(),
}).refine(value => value.workflowState !== undefined || value.relevance !== undefined || value.note !== undefined, "At least one finding change is required");

export const CreateMonitorInput = z.object({
  name: trimmed, queries: z.array(trimmed).min(1).max(5), trigger: trimmed,
  bucket: Bucket, enabled: z.boolean().default(true),
});
export const PatchMonitorInput = CreateMonitorInput.partial().refine(value => Object.keys(value).length > 0, "At least one field is required");
