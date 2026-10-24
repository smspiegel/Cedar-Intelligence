import { Surreal, type ConnectOptions } from "surrealdb";
import type { AppConfig } from "../config.js";

export const surrealConnectOptions = (config: AppConfig, selectDatabase = true): ConnectOptions => ({
  ...(selectDatabase ? { namespace: config.SURREAL_NAMESPACE, database: config.SURREAL_DATABASE } : {}),
  authentication: {
    username: config.SURREAL_USERNAME,
    password: config.SURREAL_PASSWORD,
  },
  reconnect: {
    enabled: true,
    attempts: -1,
    retryDelay: 250,
    retryDelayMax: 10_000,
    retryDelayMultiplier: 2,
    retryDelayJitter: 0.2,
  },
});

export const connectSurreal = async (config: AppConfig, selectDatabase = true) => {
  const db = new Surreal();
  await db.connect(config.SURREAL_URL, surrealConnectOptions(config, selectDatabase));
  return db;
};
