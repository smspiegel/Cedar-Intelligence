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
  async ping() { await this.db.query("RETURN true"); }
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
  async updateMonitorIfVersion(v: Monitor, expectedVersion: number) {
    const { id, ...data } = v;
    const [rows] = await this.db.query<[Array<Monitor>]>(
      "UPDATE monitor CONTENT $data WHERE key = $key AND version = $expected RETURN AFTER",
      { data: { ...data, key: id }, key: id, expected: expectedVersion },
    );
    return rows.length === 1;
  }
  async createExecution(v: ExecutionRecord) { await this.put("execution", v, true); }
  async getExecution(t: string, id: string) { const v = await this.one<ExecutionRecord>("execution", id); return v?.tenantId === t ? v : null; }
  async getExecutionInternal(id: string) { return this.one<ExecutionRecord>("execution", id); }
  async listExecutions(t: string, monitorId?: string, limit = 50) {
    const where = monitorId ? "tenantId = $tenant AND monitorId = $monitor" : "tenantId = $tenant";
    const [r] = await this.db.query<[Array<ExecutionRecord & { key: string }>]>(
      `SELECT * OMIT id FROM execution WHERE ${where} ORDER BY createdAt DESC LIMIT $limit`,
      { tenant: t, monitor: monitorId, limit },
    );
    return r.map(x => withoutRecordId(x) as ExecutionRecord);
  }
  async updateExecution(v: ExecutionRecord) { await this.put("execution", v); }
  async putObservation(v: Observation) { return this.insertOnce("observation", v); }
  async putEvaluation(v: Evaluation) { await this.put("evaluation", v); }
  async putFinding(v: Finding) { return this.insertOnce("finding", v); }
  private async insertOnce(table: string, v: { id: string }) {
    const { id, ...data } = v;
    // A single insert statement makes replay protection safe when workflow retries
    // overlap. RETURN BEFORE is empty for a new record and returns the existing row
    // when the table's unique key index sees a duplicate.
    const [before] = await this.db.query<[Array<{ key: string }>]>(
      `INSERT INTO ${table} $data ON DUPLICATE KEY UPDATE key = key RETURN BEFORE`,
      { data: { ...data, key: id } },
    );
    return before.length === 0;
  }
  async listFindings(t: string, monitorId?: string) {
    const where = monitorId ? "tenantId = $tenant AND monitorId = $monitor" : "tenantId = $tenant";
    const [r] = await this.db.query<[Array<Finding & { key: string }>]>(`SELECT * OMIT id FROM finding WHERE ${where} ORDER BY createdAt DESC`, { tenant: t, monitor: monitorId });
    return r.map(x => withoutRecordId(x) as Finding);
  }
  async getFinding(t: string, id: string) { const v = await this.one<Finding>("finding", id); return v?.tenantId === t ? v : null; }
  async getObservations(t: string, ids: string[]) {
    if (ids.length === 0) return [];
    const [r] = await this.db.query<[Array<Observation & { key: string }>]>(
      "SELECT * OMIT id FROM observation WHERE tenantId = $tenant AND key IN $ids",
      { tenant: t, ids },
    );
    const byId = new Map(r.map(row => [row.key, withoutRecordId(row) as Observation]));
    return ids.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
  }
}
