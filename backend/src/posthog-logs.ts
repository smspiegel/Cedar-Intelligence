import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { AppConfig } from "./config.js";

type LogAttributes = Record<string, string | number | boolean>;

export interface PostHogLogCapture {
  info(body: string, attributes?: LogAttributes): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export const createPostHogLogCapture = (config: AppConfig): PostHogLogCapture | undefined => {
  if (!config.POSTHOG_API_KEY || !config.POSTHOG_HOST) return undefined;

  const processor = new BatchLogRecordProcessor({
    exporter: new OTLPLogExporter({
      url: `${config.POSTHOG_HOST.replace(/\/$/, "")}/i/v1/logs`,
      headers: { Authorization: `Bearer ${config.POSTHOG_API_KEY}` },
    }),
  });
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ "service.name": "cedar-backend" }),
    logRecordProcessors: [processor],
  });
  sdk.start();
  const logger = logs.getLogger("cedar-posthog-log-capture");

  return {
    info: (body, attributes) => logger.emit({ severityText: "info", body, attributes }),
    flush: () => processor.forceFlush(),
    shutdown: () => sdk.shutdown(),
  };
};
