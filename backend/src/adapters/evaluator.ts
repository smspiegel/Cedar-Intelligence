import { EvaluationResult, type Monitor, type Observation } from "../domain.js";
import type { AppConfig } from "../config.js";
import type { FindingEvaluator } from "../ports.js";

const SYSTEM = `You evaluate observations against monitor instructions. Return JSON only in this shape:
{"verdicts":[{"verdict":"match|no_match|insufficient_evidence","title":"...","rationale":"...","observationIds":["..."]}]}
You may return multiple verdicts/findings. Cite only supplied observation IDs. Never assign priority and never invent evidence.`;

export class LlmFindingEvaluator implements FindingEvaluator {
  constructor(private config: AppConfig) {}
  async evaluate(input: { monitor: Monitor; observations: Observation[]; context: string }) {
    if (!this.config.EVALUATOR_URL || !this.config.EVALUATOR_API_KEY) throw new Error("LLM evaluator is not configured");
    const evidence = input.observations.map((observation, index) => ({
      id: `obs_${index + 1}`, content: observation.content, sourceURL: observation.sourceURL,
      publishedAt: observation.publishedAt, sourceType: observation.sourceType, sourceKey: observation.sourceKey,
    }));
    const evidenceIds = evidence.map(item => item.id);
    const response = await fetch(this.config.EVALUATOR_URL, {
      method: "POST", headers: { authorization: `Bearer ${this.config.EVALUATOR_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: this.config.EVALUATOR_MODEL, messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ instructions: input.monitor.instructions, context: input.context, observations: evidence }) },
      ], response_format: {
        type: "json_schema",
        json_schema: {
          name: "cedar_evaluation",
          strict: true,
          schema: {
            type: "object", additionalProperties: false, required: ["verdicts"],
            properties: {
              verdicts: {
                type: "array", minItems: 1,
                items: {
                  type: "object", additionalProperties: false,
                  required: ["verdict", "title", "rationale", "observationIds"],
                  properties: {
                    verdict: { type: "string", enum: ["match", "no_match", "insufficient_evidence"] },
                    title: { type: "string", minLength: 1 }, rationale: { type: "string", minLength: 1 },
                    observationIds: { type: "array", items: evidenceIds.length ? { type: "string", enum: evidenceIds } : { type: "string" } },
                  },
                },
              },
            },
          },
        },
      }, temperature: 0 }),
    });
    if (!response.ok) throw new Error(`Evaluator HTTP ${response.status}: ${await response.text()}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = EvaluationResult.parse(JSON.parse(body.choices?.[0]?.message?.content ?? ""));
    const aliases = new Map(evidence.map((item, index) => [item.id, input.observations[index].id]));
    for (const verdict of parsed.verdicts) if (verdict.observationIds.some(id => !aliases.has(id))) throw new Error("Evaluator cited an unknown observation ID");
    return { verdicts: parsed.verdicts.map(verdict => ({ ...verdict, observationIds: verdict.observationIds.map(id => aliases.get(id)!) })) };
  }
}
