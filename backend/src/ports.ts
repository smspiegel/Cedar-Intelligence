import type { EvaluationRecord, EvaluationResult, ExecutionRecord, Finding, FindingEvent, MemoryOutboxEvent, Monitor, Observation, SearchResult } from "./domain.js";

export interface Repository {
  initialize(): Promise<void>;
  ping(): Promise<void>;
  createMonitor(value: Monitor): Promise<void>;
  getMonitor(tenantId: string, id: string): Promise<Monitor | null>;
  listMonitors(tenantId: string): Promise<Monitor[]>;
  listEnabledMonitors(): Promise<Monitor[]>;
  updateMonitorIfVersion(value: Monitor, expectedVersion: number): Promise<boolean>;
  createExecution(value: ExecutionRecord): Promise<void>;
  getExecution(tenantId: string, id: string): Promise<ExecutionRecord | null>;
  getExecutionInternal(id: string): Promise<ExecutionRecord | null>;
  listExecutions(tenantId: string, monitorId?: string, limit?: number): Promise<ExecutionRecord[]>;
  hasActiveExecution(monitorId: string): Promise<boolean>;
  updateExecution(value: ExecutionRecord): Promise<void>;
  setExecutionRenderRunId(id: string, renderRunId: string): Promise<void>;
  putObservation(value: Observation): Promise<boolean>;
  getObservation(id: string): Promise<Observation | null>;
  markObservationProcessed(id: string, processedAt: string): Promise<void>;
  putEvaluation(value: EvaluationRecord): Promise<boolean>;
  putFinding(value: Finding): Promise<boolean>;
  updateFindingIfVersion(value: Finding, expectedVersion: number): Promise<boolean>;
  listFindings(tenantId: string, monitorId?: string): Promise<Finding[]>;
  countFindings(tenantId: string, monitorId: string): Promise<number>;
  getFinding(tenantId: string, id: string): Promise<Finding | null>;
  putFindingEvent(value: FindingEvent): Promise<boolean>;
  getFindingEvent(id: string): Promise<FindingEvent | null>;
  putFindingEventWithMemoryOutbox(value: FindingEvent, outbox?: MemoryOutboxEvent): Promise<void>;
  listFindingEvents(tenantId: string, findingId: string): Promise<FindingEvent[]>;
  putMemoryOutboxEvent(value: MemoryOutboxEvent): Promise<boolean>;
  listPendingMemoryOutboxEvents(tenantId: string, monitorId: string, limit?: number): Promise<MemoryOutboxEvent[]>;
  markMemoryOutboxSynced(id: string, updatedAt: string, memorySessionId?: string, memoryTurnId?: string): Promise<void>;
  markMemoryOutboxFailed(id: string, updatedAt: string, error: string): Promise<void>;
  getObservations(tenantId: string, ids: string[]): Promise<Observation[]>;
  close(): Promise<void>;
}

export interface WorkflowDispatcher { start(executionId: string): Promise<string>; }
export interface SearchAdapter { search(query: string): Promise<SearchResult[]>; }
export interface FindingEvaluator { evaluate(input: { trigger: string; result: SearchResult; historicalContext?: string; aiSessionId?: string; aiTraceId?: string }): Promise<EvaluationResult>; }

export type MemoryRecallResult = {
  status: "disabled" | "empty" | "recalled" | "unavailable";
  text: string; traceId?: string; tier?: string; hitCount: number; queryMs?: number; error?: string;
};
export interface AgentMemoryPort {
  readonly mode: "off" | "shadow" | "assist";
  recall(input: { tenantId: string; monitor: Monitor; executionId: string; candidateTitles: string[] }): Promise<MemoryRecallResult>;
  remember(event: MemoryOutboxEvent): Promise<{ sessionId?: string; turnId?: string }>;
}
