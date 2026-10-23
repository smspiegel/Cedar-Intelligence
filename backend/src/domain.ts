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

export const EvaluationResult = z.object({ matched: z.boolean(), title: trimmed, reason: trimmed });
export type EvaluationResult = z.infer<typeof EvaluationResult>;

export const ExecutionRecord = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), monitorVersion: z.number(),
  monitorSnapshot: Monitor.optional(), renderRunId: z.string().optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  resultCount: z.number().int().nonnegative().optional(), evaluatedCount: z.number().int().nonnegative().optional(),
  findingsCreated: z.number().int().nonnegative().optional(), createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(), completedAt: z.string().datetime().optional(), error: z.string().optional(),
});
export type ExecutionRecord = z.infer<typeof ExecutionRecord>;

export const Observation = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), query: z.string(),
  canonicalUrl: z.string().url(), sourceUrl: z.string().url(), title: z.string(), content: z.string(),
  publishedAt: z.string().datetime().nullable().optional(), observedAt: z.string().datetime(),
  processedAt: z.string().datetime().optional(),
});
export type Observation = z.infer<typeof Observation>;

export const Finding = z.object({
  id: z.string(), tenantId: z.string(), monitorId: z.string(), bucket: Bucket,
  title: trimmed, explanation: trimmed, sourceUrl: z.string().url(), observationId: z.string(),
  createdAt: z.string().datetime(),
});
export type Finding = z.infer<typeof Finding>;

export const CreateMonitorInput = z.object({
  name: trimmed, queries: z.array(trimmed).min(1).max(5), trigger: trimmed,
  bucket: Bucket, enabled: z.boolean().default(true),
});
export const PatchMonitorInput = CreateMonitorInput.partial().refine(value => Object.keys(value).length > 0, "At least one field is required");
