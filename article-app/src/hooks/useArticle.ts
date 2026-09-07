import { useEffect, useState, useCallback } from "react";
import { api } from "../http-client";
import {
  ArticleDetail,
  ArticleDetailResponse,
  HistoryItem,
  ParameterResult,
} from "@/utils/types";

export function useArticle(id: string) {
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState<string>("");
  const [parameterResults, setParameterResults] = useState<ParameterResult[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async (signal?: AbortSignal) => {
    if (!id) return;
    if (signal?.aborted) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api<ArticleDetailResponse>(`/articles/mine/${id}`, {
        signal,
      } as RequestInit);
      if (signal?.aborted) return;
      setArticle(result.article);
      setHistory(result.history ?? []);
      setCurrentScore(result.current_score);
      setCurrentFeedback(result.current_feedback ?? "");
      setParameterResults(result.parameter_results ?? []);
    } catch (err) {
      if (signal?.aborted) return;
      const message = err instanceof Error ? err.message : "Failed to load article";
      setError(message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const ac = new AbortController();
    fetchArticle(ac.signal);
    return () => ac.abort();
  }, [fetchArticle]);

  return {
    article,
    history,
    currentScore,
    currentFeedback,
    parameterResults,
    loading,
    error,
    refetch: fetchArticle,
    setCurrentScore,
    setCurrentFeedback,
    setParameterResults,
    setHistory,
    setArticle,
  };
}
