-- Finding workflow state remains canonical in Cedar. Agent Memory receives an
-- append-only projection through memory_outbox and can be rebuilt from these rows.
UPDATE finding SET
  workflowState = IF workflowState IS NONE { "unreviewed" } ELSE { workflowState },
  relevance = IF relevance IS NONE { "unknown" } ELSE { relevance },
  version = IF version IS NONE { 1 } ELSE { version },
  updatedAt = IF updatedAt IS NONE { createdAt } ELSE { updatedAt }
WHERE
  workflowState IS NONE
  OR relevance IS NONE
  OR version IS NONE
  OR updatedAt IS NONE;

DEFINE TABLE IF NOT EXISTS evaluation_record SCHEMALESS;
DEFINE INDEX IF NOT EXISTS evaluation_record_key ON TABLE evaluation_record FIELDS key UNIQUE;
DEFINE INDEX IF NOT EXISTS evaluation_execution_created ON TABLE evaluation_record FIELDS tenantId, executionId, createdAt;
DEFINE INDEX IF NOT EXISTS evaluation_monitor_created ON TABLE evaluation_record FIELDS tenantId, monitorId, createdAt;

DEFINE TABLE IF NOT EXISTS finding_event SCHEMALESS;
DEFINE INDEX IF NOT EXISTS finding_event_key ON TABLE finding_event FIELDS key UNIQUE;
DEFINE INDEX IF NOT EXISTS finding_event_history ON TABLE finding_event FIELDS tenantId, findingId, createdAt;
DEFINE INDEX IF NOT EXISTS finding_event_monitor_created ON TABLE finding_event FIELDS tenantId, monitorId, createdAt;

DEFINE TABLE IF NOT EXISTS memory_outbox SCHEMALESS;
DEFINE INDEX IF NOT EXISTS memory_outbox_key ON TABLE memory_outbox FIELDS key UNIQUE;
DEFINE INDEX IF NOT EXISTS memory_outbox_pending ON TABLE memory_outbox FIELDS tenantId, monitorId, status, createdAt;

DEFINE INDEX IF NOT EXISTS observation_revision ON TABLE observation FIELDS tenantId, monitorId, canonicalUrl, monitorVersion, contentHash;
