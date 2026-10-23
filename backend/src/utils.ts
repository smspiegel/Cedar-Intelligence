import { createHash, randomUUID } from "node:crypto";
export const newId = () => randomUUID();
export const stableId = (...parts: string[]) => createHash("sha256").update(parts.join("\u001f")).digest("hex");
export const now = () => new Date().toISOString();
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
export const networkErrorMessage = (error: unknown) => {
  const message = errorMessage(error);
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
  return cause && cause !== message ? `${message} (${cause})` : message;
};
export const canonicalUrl = (raw: string) => {
  const url = new URL(raw);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
};

