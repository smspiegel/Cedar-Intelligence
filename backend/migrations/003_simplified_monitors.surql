-- The tables remain schemaless so deployed legacy records stay readable while all
-- new writes use the simplified monitor, observation, and finding shapes.
UPDATE monitor SET
  queries = IF queries IS NONE {
    [name];
  } ELSE {
    queries;
  },
  trigger = IF trigger IS NONE {
    instructions;
  } ELSE {
    trigger;
  },
  bucket = IF bucket IS NONE {
    IF priority = "P1" {
      "threat";
    } ELSE IF priority = "P2" {
      "flag";
    } ELSE {
      "opportunity";
    };
  } ELSE {
    bucket;
  }
WHERE
  queries IS NONE
  OR trigger IS NONE
  OR bucket IS NONE;

UPDATE finding SET
  observationId = IF observationId IS NONE {
    observationIds[0];
  } ELSE {
    observationId;
  },
  bucket = IF bucket IS NONE {
    IF priority = "P1" {
      "threat";
    } ELSE IF priority = "P2" {
      "flag";
    } ELSE {
      "opportunity";
    };
  } ELSE {
    bucket;
  }
WHERE
  observationId IS NONE
  OR bucket IS NONE;

DEFINE INDEX IF NOT EXISTS monitor_enabled_deleted ON TABLE monitor FIELDS enabled, deletedAt;
DEFINE INDEX IF NOT EXISTS execution_monitor_status ON TABLE execution FIELDS monitorId, status;
DEFINE INDEX IF NOT EXISTS observation_tenant_monitor_url ON TABLE observation FIELDS tenantId, monitorId, canonicalUrl;
DEFINE INDEX IF NOT EXISTS finding_tenant_bucket_created ON TABLE finding FIELDS tenantId, bucket, createdAt;
