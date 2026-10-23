import { SearchResult, type SearchResult as SearchResultValue } from "../domain.js";
import type { AppConfig } from "../config.js";
import type { SearchAdapter } from "../ports.js";
import { networkErrorMessage } from "../utils.js";

type ExaResult = { url?: unknown; title?: unknown; text?: unknown; summary?: unknown; highlights?: unknown; publishedDate?: unknown };

export class ExaSearchAdapter implements SearchAdapter {
  constructor(private config: AppConfig) {}

  async search(query: string): Promise<SearchResultValue[]> {
    if (!this.config.EXA_API_KEY) throw new Error("Exa search is not configured (EXA_API_KEY is missing)");
    let response: Response;
    try {
      response = await fetch(this.config.EXA_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.config.EXA_API_KEY },
        body: JSON.stringify({ query, type: "auto", numResults: this.config.EXA_RESULTS_PER_QUERY, contents: { highlights: true }, moderation: true }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new Error(`Exa search request failed before receiving a response: ${networkErrorMessage(error)}`, { cause: error });
    }
    if (!response.ok) throw new Error(`Exa search failed with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const body = await response.json() as { results?: ExaResult[] };
    if (!Array.isArray(body.results)) throw new Error("Exa search returned an invalid response");
    return body.results.flatMap(result => {
      const highlights = Array.isArray(result.highlights) ? result.highlights.filter((value): value is string => typeof value === "string") : [];
      const content = highlights.join("\n\n") || (typeof result.summary === "string" ? result.summary : "") || (typeof result.text === "string" ? result.text : "");
      const candidate = SearchResult.safeParse({
        url: result.url, title: typeof result.title === "string" && result.title.trim() ? result.title : "Untitled result",
        content, publishedAt: typeof result.publishedDate === "string" ? result.publishedDate : null,
      });
      return candidate.success ? [candidate.data] : [];
    });
  }
}
