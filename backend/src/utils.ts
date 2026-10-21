import { createHash, randomUUID } from "node:crypto";
export const newId = () => randomUUID();
export const stableId = (...parts: string[]) => createHash("sha256").update(parts.join("\u001f")).digest("hex");
export const now = () => new Date().toISOString();
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

