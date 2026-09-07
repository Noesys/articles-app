// db/evaluateArticle.service.ts
import {
  getArticleTypeConfig,
  getActiveParameters,
} from "./evaluation.service";
import {
  persistEvaluationResults,
  handleEvaluationFailure,
} from "./evaluationPersistence.service";
import {
  getScoreableParameters,
  buildEvaluationSchema,
  buildEvaluationPrompt,
} from "./evaluationBuilder.service";
import { evaluateArticle as callAI } from "./ai.service";
import type {
  EvaluationOutcome,
  ParameterResultInput,
} from "../../types/user-types";

export async function evaluateArticle(
  db: D1Database,
  GOOGLE_API_KEY: string,
  articleId: string,
  articleTypeId: string,
  title: string,
  content: string,
  version: number,
): Promise<void> {
  try {
    const articleType = await getArticleTypeConfig(db, articleTypeId);
    if (!articleType) {
      throw new Error(`Article type ${articleTypeId} not found or inactive`);
    }

    const allParameters = await getActiveParameters(db, articleTypeId);
    const scoreable = getScoreableParameters(allParameters);

    const skipped = allParameters.filter(
      (p) => p.scope_type === "option" && p.options.length === 0,
    );
    if (skipped.length > 0) {
      console.warn(
        `evaluateArticle: skipping option-scope parameters with no active options: ${skipped
          .map((p) => p.name)
          .join(", ")}`,
      );
    }

    const schema = buildEvaluationSchema(articleType, scoreable);
    const prompt = buildEvaluationPrompt(
      articleType,
      scoreable,
      title,
      content,
    );

    const aiResult = await callAI(GOOGLE_API_KEY, prompt, schema);

    const parameterResults: ParameterResultInput[] = scoreable.map((p, i) => {
      const key = `p${i}`;
      const rawValue = (aiResult.parameters as Record<string, number | string>)[
        key
      ];

      if (p.scope_type === "numeric") {
        const numericValue = rawValue as number;
        return {
          parameter_id: p.id,
          value: String(numericValue),
          option_id: null,
          numeric_value: numericValue,
        };
      }

      const label = rawValue as string;
      const matchedOption = p.options.find((o) => o.label === label);
      if (!matchedOption) {
        // Defensive only — the zod enum should make this unreachable
        throw new Error(
          `Unrecognized option "${label}" returned for parameter "${p.name}"`,
        );
      }
      return {
        parameter_id: p.id,
        value: matchedOption.label,
        option_id: matchedOption.id,
        numeric_value: null,
      };
    });

    const status: EvaluationOutcome["status"] =
      aiResult.score >= articleType.pass_threshold
        ? "approved"
        : "rewrite_required";

    await persistEvaluationResults(db, articleId, version, {
      ai_score: aiResult.score,
      ai_feedback: aiResult.feedback,
      status,
      pass_threshold: articleType.pass_threshold,
      parameter_results: parameterResults,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Article evaluation failed:", msg, error);
    await handleEvaluationFailure(db, articleId, msg);
    throw error;
  }
}
