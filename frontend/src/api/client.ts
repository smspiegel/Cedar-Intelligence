export type Bucket = "threat" | "flag" | "opportunity";
export type ExecutionStatus = "queued" | "running" | "completed" | "failed";

export type Execution = {
  id: string; monitorId: string; monitorVersion: number; renderRunId?: string;
  status: ExecutionStatus; resultCount?: number; evaluatedCount?: number; findingsCreated?: number;
  createdAt: string; startedAt?: string; completedAt?: string; error?: string;
};

export type Monitor = {
  id: string; version: number; name: string; queries: string[]; trigger: string; bucket: Bucket;
  enabled: boolean; createdAt: string; updatedAt: string; lastExecution?: Execution | null;
  findingsCount?: number; executions?: Execution[];
};

export type MonitorInput = Pick<Monitor, "name" | "queries" | "trigger" | "bucket" | "enabled">;
export type Finding = {
  id: string; monitorId: string; bucket: Bucket; title: string; explanation: string;
  sourceUrl: string; observationId: string; createdAt: string;
};

type Envelope<T> = { data: T };
type Collection<T> = Envelope<T[]> & { meta?: { limit: number; hasMore?: boolean } };
type ErrorEnvelope = { error?: { message?: string } };
type AccessTokenProvider = () => Promise<string | null>;

export class CedarApiError extends Error {}

export class CedarApi {
  constructor(private baseUrl: string, private getAccessToken: AccessTokenProvider) {}
  listMonitors() { return this.request<Collection<Monitor>>("/v1/monitors"); }
  getMonitor(id: string) { return this.request<Envelope<Monitor>>(`/v1/monitors/${encodeURIComponent(id)}`); }
  createMonitor(input: MonitorInput) { return this.request<Envelope<Monitor>>("/v1/monitors", { method: "POST", body: JSON.stringify(input) }); }
  updateMonitor(id: string, version: number, input: Partial<MonitorInput>) { return this.request<Envelope<Monitor>>(`/v1/monitors/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "if-match": String(version) }, body: JSON.stringify(input) }); }
  deleteMonitor(id: string) { return this.request<void>(`/v1/monitors/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  startExecution(monitorId: string) { return this.request<Envelope<Execution>>(`/v1/monitors/${encodeURIComponent(monitorId)}/executions`, { method: "POST", headers: { "idempotency-key": `${Date.now()}-${Math.random()}` } }); }
  listExecutions(monitorId: string) { return this.request<Collection<Execution>>(`/v1/monitors/${encodeURIComponent(monitorId)}/executions`); }
  getExecution(id: string) { return this.request<Envelope<Execution>>(`/v1/executions/${encodeURIComponent(id)}`); }
  listFindings(monitorId?: string) { const query = monitorId ? `?monitorId=${encodeURIComponent(monitorId)}` : ""; return this.request<Collection<Finding>>(`/v1/findings${query}`); }
  getFinding(id: string) { return this.request<Envelope<Finding>>(`/v1/findings/${encodeURIComponent(id)}`); }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    if (!token) throw new CedarApiError("Your session has expired. Please sign in again.");
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { accept: "application/json", authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ErrorEnvelope;
      throw new CedarApiError(body.error?.message ?? `Request failed (${response.status})`);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  }
}

export const createDevelopmentApi = () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  const token = __DEV__ ? process.env.EXPO_PUBLIC_DEV_API_TOKEN : undefined;
  return baseUrl && token ? new CedarApi(baseUrl, async () => token) : null;
};

export const createClerkApi = (getToken: AccessTokenProvider) => {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  const developmentToken = __DEV__ ? process.env.EXPO_PUBLIC_DEV_API_TOKEN : undefined;
  return baseUrl ? new CedarApi(baseUrl, developmentToken ? async () => developmentToken : getToken) : null;
};
