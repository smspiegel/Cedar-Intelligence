-- These composite indexes match the monitor screens' filter-and-sort patterns.
DEFINE INDEX IF NOT EXISTS monitor_tenant_created ON TABLE monitor FIELDS tenantId, createdAt;
DEFINE INDEX IF NOT EXISTS monitor_tenant_updated ON TABLE monitor FIELDS tenantId, updatedAt;
DEFINE INDEX IF NOT EXISTS execution_tenant_monitor_created ON TABLE execution FIELDS tenantId, monitorId, createdAt;
DEFINE INDEX IF NOT EXISTS finding_tenant_monitor_created ON TABLE finding FIELDS tenantId, monitorId, createdAt;
DEFINE INDEX IF NOT EXISTS observation_tenant_monitor ON TABLE observation FIELDS tenantId, monitorId;
DEFINE INDEX IF NOT EXISTS evaluation_execution ON TABLE evaluation FIELDS executionId
  UNIQUE;
