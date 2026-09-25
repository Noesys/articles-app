import type { Bindings } from "../../types/shared-types";
import type { EvaluateArticleParams } from "../../workflows/evaluateArticle.workflow";
import { handleEvaluationFailure } from "./evaluationPersistence.service";

/**
 * Hands an evaluation to the EvaluateArticleWorkflow. Never throws: if the
 * workflow can't be started the article is marked failed so it doesn't sit
 * "pending" forever, and the caller still returns its normal response.
 */
export async function startEvaluation(env: Bindings, params: EvaluateArticleParams): Promise<void> {
  try {
    await env.EVALUATE_WORKFLOW.create({ params });
  } catch (err: unknown) {
    console.error("Failed to start evaluation workflow:", err);
    await handleEvaluationFailure(
      env.DB,
      params.articleId,
      params.version,
      "Could not start the evaluation. Please try again.",
    );
  }
}
