import { z } from "zod";
import {
  AIParameterEvaluation,
  ArticleTypeConfig,
  ParameterConfig,
} from "../../types/user-types";
export function getScoreableParameters(
  parameters: ParameterConfig[],
): ParameterConfig[] {
  return parameters.filter(
    (p) => p.scope_type === "numeric" || p.options.length > 0,
  );
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
  const paramShape: Record<string, z.ZodType<AIParameterEvaluation>> = {};
  // D1 may surface numeric columns as numbers or numeric strings
  const scoreMin = Number(articleType.score_min);
  const scoreMax = Number(articleType.score_max);

  parameters.forEach((p, i) => {
    const key = `p${i}`; // safe identifier, no hyphens
    const valueSchema =
      p.scope_type === "numeric"
        ? (() => {
            const min = Number(p.min_value ?? 0);
            const max = Number(p.max_value ?? 10);
            // coerce: Gemini sometimes returns numeric strings
            return z.coerce
              .number()
              .min(min)
              .max(max)
              .describe(
                `${shortDescribe(p.name, p.prompt)} (whole number, no decimals)`,
              );
          })()
        : (() => {
            const labels = p.options.map((o) => o.label);
            return z
              .enum(labels as [string, ...string[]])
              .describe(shortDescribe(p.name, p.prompt));
          })();
    paramShape[key] = z.object({
      value: valueSchema,
      feedback: z
        .string()
        .min(1)
        .max(4000)
        .describe(
          `Markdown feedback for "${p.name}" only, in the format the parameter prompt requests (bullets, table row, or short sections). Ground it in the article with specific observations.`,
        ),
    });
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
        'Markdown feedback. Follow the output format specified in the user prompt exactly (tables, columns, headings, bullets). Ground every row/cell in the submitted article with specific observations.',
      ),
    suggested_title: z
      .string()
      .min(1)
      .describe(
        "Improved article title; concise, clear, and faithful to the content.",
      ),
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
      const valueLine =
        p.scope_type === "numeric"
          ? `Return "value" as a whole number (integer, no decimals) between ${p.min_value} and ${p.max_value}.`
          : `Return "value" as EXACTLY one of these labels: ${p.options.map((o) => o.label).join(", ")}.`;
      return (
        `- key "${key}" (${p.name}): ${p.prompt}\n  ${valueLine}\n` +
        `  Return "feedback" for this parameter only, following the output format its prompt requests, grounded in the article with specific observations.`
      );
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

Write "feedback" as a human reviewer's written feedback to the author, following the format below exactly.
<feedback_criteria>
${articleType.score_prompt}
</feedback_criteria>
Follow the structure in <feedback_criteria> exactly — if it specifies a table with columns (e.g. Evaluation, What Works Well, What Needs Improvement), reproduce that table with one grounded row per criterion. Fill every column from the submitted article with specific observations; never leave the improvement column generic or empty. Do not mention "instructions", "criteria", or "prompt".

Return "suggested_title" as a single improved title for this article: concise, clear, and faithful to the content. Do not wrap it in quotes.

Also evaluate each of the following parameters and return them under "parameters", keyed by the exact key given (p0, p1, ...):

${paramInstructions || "(no additional parameters configured)"}
`.trim();
}
