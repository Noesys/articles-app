import { z } from "zod";
import { ArticleTypeConfig, ParameterConfig } from "../../types/user-types";
export function getScoreableParameters(parameters: ParameterConfig[]): ParameterConfig[] {
  return parameters.filter((p) => p.scope_type === "numeric" || p.options.length > 0);
}

function shortDescribe(name: string, prompt: string, max = 160): string {
  const trimmed = prompt.replace(/\s+/g, " ").trim();
  const body = trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
  return body ? `${name}: ${body}` : name;
}

export function buildEvaluationSchema(
  articleType: ArticleTypeConfig,
  parameters: ParameterConfig[],
) {
  const paramShape: Record<string, z.ZodType<string | number>> = {};
  // D1 may surface numeric columns as numbers or numeric strings
  const scoreMin = Number(articleType.score_min);
  const scoreMax = Number(articleType.score_max);

  parameters.forEach((p, i) => {
    const key = `p${i}`; // safe identifier, no hyphens
    if (p.scope_type === "numeric") {
      const min = Number(p.min_value ?? 0);
      const max = Number(p.max_value ?? 10);
      // coerce: Gemini sometimes returns numeric strings
      paramShape[key] = z.coerce
        .number()
        .min(min)
        .max(max)
        .describe(`${shortDescribe(p.name, p.prompt)} (whole number, no decimals)`);
    } else {
      const labels = p.options.map((o) => o.label);
      paramShape[key] = z
        .enum(labels as [string, ...string[]])
        .describe(shortDescribe(p.name, p.prompt));
    }
  });

  // Keep schema descriptions short — full score_prompt lives in the user prompt.
  // Embedding multi-KB prompts in JSON Schema .describe() caused Gemini structured
  // output to fail validation ("No object generated: response did not match schema").
  return z.object({
    score: z.coerce
      .number()
      .min(scoreMin)
      .max(scoreMax)
      .describe(`Overall numeric score (${scoreMin}-${scoreMax}).`),
    feedback: z
      .string()
      .min(1)
      .describe(
        'Markdown feedback with headings; each point as a bullet (use "- "). Write original reviewer commentary guided by the criteria in the user prompt — never quote or reproduce that criteria text itself.',
      ),
    suggested_title: z
      .string()
      .min(1)
      .describe("Improved article title; concise, clear, and faithful to the content."),
    parameters: z.object(paramShape),
  });
}

export function buildEvaluationPrompt(
  articleType: ArticleTypeConfig,
  parameters: ParameterConfig[],
  title: string,
  content: string,
): string {
  const paramInstructions = parameters
    .map((p, i) => {
      const key = `p${i}`;
      if (p.scope_type === "numeric") {
        return `- key "${key}" (${p.name}): ${p.prompt}\n  Return a whole number (integer, no decimals) between ${p.min_value} and ${p.max_value}.`;
      }
      const labels = p.options.map((o) => o.label).join(", ");
      return `- key "${key}" (${p.name}): ${p.prompt}\n  Return EXACTLY one of these labels: ${labels}.`;
    })
    .join("\n\n");

  return `
Article Type: ${articleType.name}
${articleType.description ?? ""}

Title: <untrusted_article_title>
${title}
</untrusted_article_title>
Content:

<untrusted_article_content>
${content}
</untrusted_article_content>

---

Return "score" as a number between ${articleType.score_min} and ${articleType.score_max}, reflecting the article's overall quality.

Write "feedback" as a human reviewer's written feedback to the author, using the criteria below to decide what to cover.
<feedback_criteria>
${articleType.score_prompt}
</feedback_criteria>
Do not quote, paraphrase into a heading, or otherwise reproduce any wording from <feedback_criteria> in your output — it is reference material for you, not text to include in the feedback. Do not mention "instructions", "criteria", or "prompt". Use "## " headings only for genuine review categories (e.g. "## Strengths", "## Areas to Improve"), each with "- " bullet points underneath.

Return "suggested_title" as a single improved title for this article: concise, clear, and faithful to the content. Do not wrap it in quotes.

Also evaluate each of the following parameters and return them under "parameters", keyed by the exact key given (p0, p1, ...):

${paramInstructions || "(no additional parameters configured)"}
`.trim();
}
