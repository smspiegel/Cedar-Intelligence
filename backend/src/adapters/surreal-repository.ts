import { Surreal } from "surrealdb";
import type { ExecutionRecord, Finding, Monitor, Observation } from "../domain.js";
import type { Repository } from "../ports.js";
import type { AppConfig } from "../config.js";

const withoutRecordId = <T extends { key: string }>(row: T): Omit<T, "key"> & { id: string } => { const { key, ...value } = row; return { ...value, id: key }; };

export class SurrealRepository implements Repository {
  constructor(private db: Surreal, private config: AppConfig) {}
  static async connect(config: AppConfig) {
    const db = new Surreal(); await db.connect(config.SURREAL_URL);
    await db.use({ namespace: config.SURREAL_NAMESPACE, database: config.SURREAL_DATABASE });
    await db.signin({ username: config.SURREAL_USERNAME, password: config.SURREAL_PASSWORD });
    return new SurrealRepository(db, config);
  }
  async initialize() {}
  async ping() { await this.db.query("RETURN true"); }
  async close() { await this.db.close(); }
  private async one<T>(table: string, key: string): Promise<T | null> {
    const [rows] = await this.db.query<[Array<T & { key: string }>]>(`SELECT * OMIT id FROM ${table} WHERE key = $key LIMIT 1`, { key });
    return rows[0] ? withoutRecordId(rows[0]) as T : null;
  }
  private async put(table: string, value: { id: string }, create = false) {
    const { id, ...data } = value; await this.db.query(`${create ? "CREATE" : "UPSERT"} ${table} CONTENT $data`, { data: { ...data, key: id } });
  }
  async createMonitor(value: Monitor) { await this.put("monitor", value, true); }
  async getMonitor(tenantId: string, id: string) { const value = await this.one<Monitor>("monitor", id); return value?.tenantId === tenantId && !value.deletedAt ? this.normalizeMonitor(value) : null; }
  async listMonitors(tenantId: string) {
    const [rows] = await this.db.query<[Array<Monitor & { key: string }>]>("SELECT * OMIT id FROM monitor WHERE tenantId = $tenant AND deletedAt IS NONE ORDER BY createdAt", { tenant: tenantId });
    return rows.map(row => this.normalizeMonitor(withoutRecordId(row) as Monitor));
  }
  async listEnabledMonitors() {
    const [rows] = await this.db.query<[Array<Monitor & { key: string }>]>("SELECT * OMIT id FROM monitor WHERE enabled = true AND deletedAt IS NONE ORDER BY createdAt");
    return rows.map(row => this.normalizeMonitor(withoutRecordId(row) as Monitor));
  }
  async updateMonitorIfVersion(value: Monitor, expectedVersion: number) {
    const { id, ...data } = value;
    const [rows] = await this.db.query<[Array<Monitor>]>("UPDATE monitor CONTENT $data WHERE key = $key AND version = $expected RETURN AFTER", { data: { ...data, key: id }, key: id, expected: expectedVersion });
    return rows.length === 1;
  }
  async createExecution(value: ExecutionRecord) { await this.put("execution", value, true); }
  async getExecution(tenantId: string, id: string) { const value = await this.one<ExecutionRecord>("execution", id); return value?.tenantId === tenantId ? value : null; }
  async getExecutionInternal(id: string) { return this.one<ExecutionRecord>("execution", id); }
  async listExecutions(tenantId: string, monitorId?: string, limit = 50) {
    const where = monitorId ? "tenantId = $tenant AND monitorId = $monitor" : "tenantId = $tenant";
    const [rows] = await this.db.query<[Array<ExecutionRecord & { key: string }>]>(`SELECT * OMIT id FROM execution WHERE ${where} ORDER BY createdAt DESC LIMIT $limit`, { tenant: tenantId, monitor: monitorId, limit });
    return rows.map(row => withoutRecordId(row) as ExecutionRecord);
  }
  async hasActiveExecution(monitorId: string) {
    const [rows] = await this.db.query<[Array<{ key: string }>]>("SELECT key FROM execution WHERE monitorId = $monitor AND status IN ['queued', 'running'] LIMIT 1", { monitor: monitorId });
    return rows.length > 0;
  }
  async updateExecution(value: ExecutionRecord) { await this.put("execution", value); }
  async setExecutionRenderRunId(id: string, renderRunId: string) { await this.db.query("UPDATE execution SET renderRunId = $renderRunId WHERE key = $key", { key: id, renderRunId }); }
  async putObservation(value: Observation) { return this.insertOnce("observation", value); }
  async getObservation(id: string) { return this.one<Observation>("observation", id); }
  async markObservationProcessed(id: string, processedAt: string) { await this.db.query("UPDATE observation SET processedAt = $processedAt WHERE key = $key", { key: id, processedAt }); }
  async putFinding(value: Finding) { return this.insertOnce("finding", value); }
  private async insertOnce(table: string, value: { id: string }) {
    const { id, ...data } = value;
    const [before] = await this.db.query<[Array<{ key: string }>]>(`INSERT INTO ${table} $data ON DUPLICATE KEY UPDATE key = key RETURN BEFORE`, { data: { ...data, key: id } });
    return before.length === 0;
  }
  async listFindings(tenantId: string, monitorId?: string) {
    const where = monitorId ? "tenantId = $tenant AND monitorId = $monitor" : "tenantId = $tenant";
    const [rows] = await this.db.query<[Array<Finding & { key: string }>]>(`SELECT * OMIT id FROM finding WHERE ${where} ORDER BY createdAt DESC`, { tenant: tenantId, monitor: monitorId });
    return Promise.all(rows.map(row => this.normalizeFinding(withoutRecordId(row) as Finding)));
  }
  async countFindings(tenantId: string, monitorId: string) {
    const [rows] = await this.db.query<[Array<{ count: number }>]>("SELECT count() AS count FROM finding WHERE tenantId = $tenant AND monitorId = $monitor GROUP ALL", { tenant: tenantId, monitor: monitorId });
    return rows[0]?.count ?? 0;
  }
  async getFinding(tenantId: string, id: string) { const value = await this.one<Finding>("finding", id); return value?.tenantId === tenantId ? this.normalizeFinding(value) : null; }
  async getObservations(tenantId: string, ids: string[]) {
    if (!ids.length) return [];
    const [rows] = await this.db.query<[Array<Observation & { key: string }>]>("SELECT * OMIT id FROM observation WHERE tenantId = $tenant AND key IN $ids", { tenant: tenantId, ids });
    const byId = new Map(rows.map(row => [row.key, withoutRecordId(row) as Observation]));
    return ids.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
  }
  private normalizeMonitor(value: Monitor) {
    const legacy = value as Monitor & {
      instructions?: string; priority?: "P1" | "P2" | "P3";
      context?: unknown; memoryScope?: unknown; sources?: unknown;
    };
    const queries = Array.isArray(legacy.queries) && legacy.queries.length ? legacy.queries : [legacy.name];
    const trigger = legacy.trigger ?? legacy.instructions ?? legacy.name;
    const bucket = legacy.bucket ?? (legacy.priority === "P1" ? "threat" : legacy.priority === "P2" ? "flag" : "opportunity");
    const { instructions: _instructions, priority: _priority, context: _context, memoryScope: _memoryScope, sources: _sources, ...monitor } = legacy;
    return { ...monitor, queries, trigger, bucket } as Monitor;
  }
  private async normalizeFinding(value: Finding) {
    const legacy = value as Finding & { priority?: "P1" | "P2" | "P3"; observationIds?: string[] };
    const observationId = legacy.observationId ?? legacy.observationIds?.[0];
    const bucket = legacy.bucket ?? (legacy.priority === "P1" ? "threat" : legacy.priority === "P2" ? "flag" : "opportunity");
    const { priority: _priority, observationIds: _observationIds, ...finding } = legacy;
    if (legacy.sourceUrl || !observationId) return { ...finding, observationId, bucket } as Finding;
    const observation = await this.one<Observation & { sourceURL?: string }>("observation", observationId);
    return { ...finding, observationId, bucket, sourceUrl: observation?.sourceUrl ?? observation?.sourceURL } as Finding;
  }
}
