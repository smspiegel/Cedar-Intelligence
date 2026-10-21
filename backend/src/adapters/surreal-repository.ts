import { Surreal } from "surrealdb";
import type { Evaluation, ExecutionRecord, Finding, Monitor, Observation, Organization } from "../domain.js";
import type { Repository } from "../ports.js";
import type { AppConfig } from "../config.js";

const withoutRecordId = <T extends { key: string }>(row: T): Omit<T, "key"> & { id: string } => {
  const { key, ...value } = row; return { ...value, id: key };
};

export class SurrealRepository implements Repository {
  constructor(private db: Surreal, private config: AppConfig) {}
  static async connect(config: AppConfig) {
    const db = new Surreal(); await db.connect(config.SURREAL_URL);
    await db.use({ namespace: config.SURREAL_NAMESPACE, database: config.SURREAL_DATABASE });
    await db.signin({ username: config.SURREAL_USERNAME, password: config.SURREAL_PASSWORD });
    return new SurrealRepository(db, config);
  }
  async initialize() { /* Run `npm run migrate`; intentionally no hidden schema mutation at startup. */ }
  async close() { await this.db.close(); }
  private async one<T>(table: string, key: string): Promise<T | null> {
    const [rows] = await this.db.query<[Array<T & { key: string }>]>(`SELECT * OMIT id FROM ${table} WHERE key = $key LIMIT 1`, { key });
    return rows[0] ? withoutRecordId(rows[0]) as T : null;
  }
  private async put(table: string, value: { id: string }, create = false) {
    const { id, ...data } = value; const statement = create ? "CREATE" : "UPSERT";
    await this.db.query(`${statement} ${table} CONTENT $data`, { data: { ...data, key: id } });
  }
  async getOrganization(id: string) { return this.one<Organization>("organization", id); }
  async putOrganization(v: Organization) { await this.put("organization", v); }
  async createMonitor(v: Monitor) { await this.put("monitor", v, true); }
  async getMonitor(t: string, id: string) { const v = await this.one<Monitor>("monitor", id); return v?.tenantId === t ? v : null; }
  async listMonitors(t: string) { const [r] = await this.db.query<[Array<Monitor & { key: string }>]>("SELECT * OMIT id FROM monitor WHERE tenantId = $tenant ORDER BY createdAt", { tenant: t }); return r.map(x => withoutRecordId(x) as Monitor); }
  async updateMonitor(v: Monitor) { await this.put("monitor", v); }
  async createExecution(v: ExecutionRecord) { await this.put("execution", v, true); }
  async getExecution(t: string, id: string) { const v = await this.one<ExecutionRecord>("execution", id); return v?.tenantId === t ? v : null; }
  async getExecutionInternal(id: string) { return this.one<ExecutionRecord>("execution", id); }
  async updateExecution(v: ExecutionRecord) { await this.put("execution", v); }
  async putObservation(v: Observation) { return this.insertOnce("observation", v); }
  async putEvaluation(v: Evaluation) { await this.put("evaluation", v); }
  async putFinding(v: Finding) { return this.insertOnce("finding", v); }
  private async insertOnce(table: string, v: { id: string }) { if (await this.one(table, v.id)) return false; await this.put(table, v, true); return true; }
  async listFindings(t: string, monitorId?: string) {
    const [r] = await this.db.query<[Array<Finding & { key: string }>]>("SELECT * OMIT id FROM finding WHERE tenantId = $tenant AND ($monitor = NONE OR monitorId = $monitor) ORDER BY createdAt DESC", { tenant: t, monitor: monitorId });
    return r.map(x => withoutRecordId(x) as Finding);
  }
}
