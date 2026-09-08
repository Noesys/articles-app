import { z } from "zod";
import { ArticleTypeConfig, ParameterConfig } from "../../types/user-types";
export function getScoreableParameters(
  parameters: ParameterConfig[],
): ParameterConfig[] {
  return parameters.filter(
    (p) => p.scope_type === "numeric" || p.options.length > 0,
  );
}

export function buildEvaluationSchema(
  articleType: ArticleTypeConfig,
  parameters: ParameterConfig[],
) {
  const paramShape: Record<string, z.ZodType<string | number>> = {};

  parameters.forEach((p, i) => {
    const key = `p${i}`; // safe identifier, no hyphens
    if (p.scope_type === "numeric") {
      const min = p.min_value ?? 0;
      const max = p.max_value ?? 10;
      paramShape[key] = z
        .number()
        .min(min)
        .max(max)
        .describe(`${p.name}: ${p.prompt}`);
    } else {
      const labels = p.options.map((o) => o.label);
      paramShape[key] = z
        .enum(labels as [string, ...string[]])
        .describe(`${p.name}: ${p.prompt}`);
    }
  });

  return z.object({
    score: z
      .number()
      .min(articleType.score_min)
      .max(articleType.score_max)
      .describe(`Overall numeric score for the article's quality.`),
    feedback: z.string().min(1).describe(articleType.score_prompt),
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
        return `- key "${key}" (${p.name}): ${p.prompt}\n  Return a number between ${p.min_value} and ${p.max_value}.`;
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

Return "feedback" following these instructions exactly:
${articleType.score_prompt}

Also evaluate each of the following parameters and return them under "parameters", keyed by the exact key given (p0, p1, ...):

${paramInstructions || "(no additional parameters configured)"}
`.trim();
}
