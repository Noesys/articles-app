import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import type { z } from "zod";
import { AIEvaluationResult } from "../../types/user-types";

export async function evaluateArticle(
  apiKey: string,
  prompt: string,
  schema: z.ZodType<AIEvaluationResult>
): Promise<AIEvaluationResult> {
  if (!apiKey) {
    throw new Error("Google Generative AI API key is missing.");
  }

  const google = createGoogleGenerativeAI({ apiKey });

  const { output } = await generateText({
    model: google("gemini-3.5-flash-lite"),
    output: Output.object({
      schema,
    }),
    system:
      "You are an article evaluator. Follow the scoring instructions exactly and only return values allowed by the schema. Evaluate article's ai_score strictly between 0-10",
    prompt,
  });

  return output as AIEvaluationResult;
} 