import type { Evaluation, ExecutionRecord, Finding, Monitor, Observation, Organization } from "./domain.js";

export interface Repository {
  initialize(): Promise<void>;
  getOrganization(tenantId: string): Promise<Organization | null>;
  putOrganization(value: Organization): Promise<void>;
  createMonitor(value: Monitor): Promise<void>;
  getMonitor(tenantId: string, id: string): Promise<Monitor | null>;
  listMonitors(tenantId: string): Promise<Monitor[]>;
  updateMonitor(value: Monitor): Promise<void>;
  createExecution(value: ExecutionRecord): Promise<void>;
  getExecution(tenantId: string, id: string): Promise<ExecutionRecord | null>;
  getExecutionInternal(id: string): Promise<ExecutionRecord | null>;
  updateExecution(value: ExecutionRecord): Promise<void>;
  putObservation(value: Observation): Promise<boolean>;
  putEvaluation(value: Evaluation): Promise<void>;
  putFinding(value: Finding): Promise<boolean>;
  listFindings(tenantId: string, monitorId?: string): Promise<Finding[]>;
  close(): Promise<void>;
}

export interface WorkflowDispatcher { start(executionId: string): Promise<string>; }
export interface ContextProvider { retrieve(org: Organization, monitor: Monitor): Promise<{ text: string; reference: string }>; }
export interface FindingEvaluator {
  evaluate(input: { monitor: Monitor; observations: Observation[]; context: string }): Promise<import("./domain.js").EvaluationResult>;
}
