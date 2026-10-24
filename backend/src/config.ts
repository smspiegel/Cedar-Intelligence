import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(value => value === "" ? undefined : value, z.string().optional());
const optionalUrl = z.preprocess(value => value === "" ? undefined : value, z.string().url().optional());
const requiredString = z.string().trim().min(1);
const commaSeparated = z.preprocess(value => {
  if (typeof value !== "string") return value;
  return value.split(",").map(item => item.trim()).filter(Boolean);
}, z.array(z.string().url()).default([]));

const Config = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTH_MODE: z.enum(["development", "jwt"]).default("development"),
  API_TOKEN: z.string().min(12).default("dev-cedar-token"),
  AUTH_ISSUER: optionalUrl, AUTH_AUDIENCE: optionalString, AUTH_JWKS_URL: optionalUrl,
  AUTH_TENANT_CLAIM: z.string().min(1).default("org_id"),
  CORS_ORIGINS: commaSeparated,
  TENANT_ID: z.string().min(1).default("demo-org"),
  SURREAL_URL: requiredString.default("ws://127.0.0.1:8000/rpc"),
  SURREAL_NAMESPACE: requiredString.default("cedar"), SURREAL_DATABASE: requiredString.default("cedar"),
  SURREAL_USERNAME: requiredString.default("root"), SURREAL_PASSWORD: requiredString.default("root"),
  RENDER_WORKFLOW_SLUG: z.string().default("cedar-workflow"),
  EXA_API_URL: z.string().url().default("https://api.exa.ai/search"), EXA_API_KEY: optionalString,
  EXA_RESULTS_PER_QUERY: z.coerce.number().int().min(1).max(25).default(10),
  EVALUATOR_URL: optionalUrl, EVALUATOR_API_KEY: optionalString,
  EVALUATOR_MODEL: z.string().default("gpt-5-mini"),
  AGENT_MEMORY_MODE: z.enum(["off", "shadow", "assist"]).default("off"),
  AGENT_MEMORY_ENDPOINT: optionalUrl, AGENT_MEMORY_CONTEXT: optionalString, AGENT_MEMORY_API_KEY: optionalString,
  AGENT_MEMORY_PRINCIPAL_PREFIX: optionalString,
  POSTHOG_API_KEY: optionalString, POSTHOG_HOST: optionalUrl,
}).superRefine((value, context) => {
  const configured = [value.AGENT_MEMORY_ENDPOINT, value.AGENT_MEMORY_CONTEXT, value.AGENT_MEMORY_API_KEY].filter(Boolean).length;
  if (configured !== 0 && configured !== 3) context.addIssue({ code: "custom", message: "Agent Memory requires endpoint, context, and API key together" });
  if (value.AGENT_MEMORY_MODE !== "off" && configured !== 3) context.addIssue({ code: "custom", message: "Agent Memory credentials are required when memory mode is enabled" });
});
export type AppConfig = z.infer<typeof Config>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => Config.parse(env);
