import { PostHog } from "posthog-node";
import type { AppConfig } from "./config.js";

export const createPostHog = (config: AppConfig) => {
  if (config.NODE_ENV !== "production") return undefined;

  if (!config.POSTHOG_API_KEY || !config.POSTHOG_HOST) {
    return undefined;
  }

  return new PostHog(config.POSTHOG_API_KEY, {
    host: config.POSTHOG_HOST,
    enableExceptionAutocapture: true,
    privacyMode: true,
  });
};
