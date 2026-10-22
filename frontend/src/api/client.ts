export type Priority = "P1" | "P2" | "P3";
export type ExecutionStatus = "queued" | "running" | "completed" | "failed";

export type Execution = {
  id: string;
  monitorId: string;
  monitorVersion: number;
  renderRunId?: string;
  status: ExecutionStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export type Monitor = {
  id: string;
  version: number;
  name: string;
  instructions: string;
  priority: Priority;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastExecution: Execution | null;
};

type Envelope<T> = { data: T };
type Collection<T> = Envelope<T[]> & { meta: { limit: number; hasMore: boolean } };
type ErrorEnvelope = { error?: { message?: string } };

export class CedarApiError extends Error {}

export class CedarApi {
  constructor(private baseUrl: string, private token: string) {}

  async listMonitors(): Promise<Collection<Monitor>> {
    return this.request<Collection<Monitor>>("/v1/monitors");
  }

  async startExecution(monitorId: string): Promise<Envelope<Execution>> {
    return this.request<Envelope<Execution>>(`/v1/monitors/${encodeURIComponent(monitorId)}/executions`, { method: "POST" });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { accept: "application/json", authorization: `Bearer ${this.token}`, ...init.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ErrorEnvelope;
      throw new CedarApiError(body.error?.message ?? `Request failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  }
}

export const createDevelopmentApi = () => {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  // Expo public variables are embedded in browser bundles. This escape hatch is only
  // available in local development; production requires the JWT integration.
  const token = __DEV__ ? process.env.EXPO_PUBLIC_DEV_API_TOKEN : undefined;
  return baseUrl && token ? new CedarApi(baseUrl, token) : null;
};
