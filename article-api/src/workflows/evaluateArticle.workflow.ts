import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Bindings } from "../types/shared-types";
import { evaluateArticle } from "../services/user/evaluateArticle.service";
import { handleEvaluationFailure } from "../services/user/evaluationPersistence.service";
import { EVALUATION_STEP_TIMEOUT_MS } from "../utils/evaluationTiming";

export type EvaluateArticleParams = {
  articleId: string;
  articleTypeId: string;
  version: number;
};

/**
 * Runs an article evaluation outside the request lifecycle. Unlike
 * ctx.waitUntil (cut off ~30s after the response), a Workflow step can wait as
 * long as the AI call needs. Title/content are read from the DB inside the step so
 * the payload stays small and the version guard applies to what is stored now.
 */
export class EvaluateArticleWorkflow extends WorkflowEntrypoint<Bindings, EvaluateArticleParams> {
  async run(event: WorkflowEvent<EvaluateArticleParams>, step: WorkflowStep) {
    const { articleId, articleTypeId, version } = event.payload;
    const db = this.env.DB;

    try {
      await step.do(
        "evaluate article",
        // Single attempt, capped under STUCK_EVALUATION_THRESHOLD_MS (also the frontend poll
        // limit). A retry would push the worst case past that window and let a run finish
        // after the user was told it timed out and re-evaluated. See utils/evaluationTiming.ts.
        { retries: { limit: 0, delay: "1 second" }, timeout: EVALUATION_STEP_TIMEOUT_MS },
        async () => {
          const row = await db
            .prepare(`SELECT title, content, version FROM articles WHERE id = ?`)
            .bind(articleId)
            .first<{ title: string; content: string; version: number }>();

          // Deleted, or superseded by a newer rewrite/re-evaluate — nothing to score.
          if (!row || row.version !== version) return { skipped: true };

          // The final failure is recorded below, after retries are exhausted, so a
          // transient error doesn't flip the article to "failed" while a retry is pending.
          await evaluateArticle(db, articleId, articleTypeId, row.title, row.content, version, this.env, {
            recordFailure: false,
          });
          return { skipped: false };
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Evaluation workflow failed:", msg, err);
      await step.do("record failure", async () => {
        await handleEvaluationFailure(db, articleId, version, msg);
      });
      throw err;
    }
  }
}
