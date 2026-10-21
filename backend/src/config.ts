import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(value => value === "" ? undefined : value, z.string().optional());
const optionalUrl = z.preprocess(value => value === "" ? undefined : value, z.string().url().optional());

const Config = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  API_TOKEN: z.string().min(12).default("dev-cedar-token"),
  TENANT_ID: z.string().min(1).default("demo-org"),
  SURREAL_URL: z.string().default("ws://127.0.0.1:8000/rpc"),
  SURREAL_NAMESPACE: z.string().default("cedar"), SURREAL_DATABASE: z.string().default("cedar"),
  SURREAL_USERNAME: z.string().default("root"), SURREAL_PASSWORD: z.string().default("root"),
  RENDER_WORKFLOW_SLUG: z.string().default("cedar-workflow"),
  EVALUATOR_URL: optionalUrl, EVALUATOR_API_KEY: optionalString,
  EVALUATOR_MODEL: z.string().default("gpt-5-mini"),
  AGENT_MEMORY_ENDPOINT: optionalUrl, AGENT_MEMORY_CONTEXT: optionalString,
  AGENT_MEMORY_API_KEY: optionalString, SEEDED_CONTEXT: z.string().default("Project Cedar seeded development context."),
});
export type AppConfig = z.infer<typeof Config>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => Config.parse(env);
