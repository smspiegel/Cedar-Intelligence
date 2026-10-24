import { PostHog } from "posthog-node";
import type { AppConfig } from "./config.js";

export const createPostHog = (config: AppConfig) => {
  if (!config.POSTHOG_API_KEY || !config.POSTHOG_HOST) {
    if (config.NODE_ENV === "development") {
      const variable = config.POSTHOG_API_KEY ? "POSTHOG_HOST" : "POSTHOG_API_KEY";
      throw new Error(`${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`);
    }
    return undefined;
  }

  return new PostHog(config.POSTHOG_API_KEY, {
    host: config.POSTHOG_HOST,
    enableExceptionAutocapture: true,
    privacyMode: true,
  });
};
