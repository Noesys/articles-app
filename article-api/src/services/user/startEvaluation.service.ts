import type { Bindings } from "../../types/shared-types";
import type { EvaluateArticleParams } from "../../workflows/evaluateArticle.workflow";
import { evaluateArticle } from "./evaluateArticle.service";
import { handleEvaluationFailure } from "./evaluationPersistence.service";

async function runEvaluationInProcess(
  env: Bindings,
  params: EvaluateArticleParams,
): Promise<void> {
  const row = await env.DB.prepare(
    `SELECT title, content, version FROM articles WHERE id = ?`,
  )
    .bind(params.articleId)
    .first<{ title: string; content: string; version: number }>();

  if (!row || row.version !== params.version) return;

  await evaluateArticle(
    env.DB,
    params.articleId,
    params.articleTypeId,
    row.title,
    row.content,
    params.version,
    env,
  );
}

/**
 * Hands an evaluation to the EvaluateArticleWorkflow. Never throws: if the
 * workflow can't be started the article is marked failed so it doesn't sit
 * "pending" forever, and the caller still returns its normal response.
 *
 * Local wrangler Workflows do not receive `.dev.vars` secrets on `this.env`,
 * so Gemini would always see GENERATIVE_AI_API_KEY as missing. The HTTP
 * Worker does have the secret — run the same scoring path in-process in
 * development.
 */
export async function startEvaluation(env: Bindings, params: EvaluateArticleParams): Promise<void> {
  try {
    if (env.ENVIRONMENT === "development") {
      void runEvaluationInProcess(env, params).catch((err: unknown) => {
        console.error(
          "In-process evaluation failed:",
          err instanceof Error ? err.message : err,
        );
      });
      return;
    }
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
