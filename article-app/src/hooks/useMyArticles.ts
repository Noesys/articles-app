import { useEffect, useState, useCallback, useRef } from "react";
import { apiFull } from "../http-client";
import { ArticleListItem, ArticleRow, PaginationInfo, UseMyArticlesOptions } from "@/utils/types";


const POLLING_INTERVAL = 2500;
const MAX_POLL_DURATION = 300000;

export function useMyArticles(options: UseMyArticlesOptions = {}) {
  const { month, viewAll = false, page, limit = 10 } = options;
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
  });
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const pollStartRef = useRef<number | null>(null);

  const fetchArticles = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const params = new URLSearchParams();
      if (viewAll) {
        params.set("viewAll", "true");
        params.set("page", String(page ?? 1));
        params.set("limit", String(limit));
      } else if (month) params.set("month", month);
      const query = params.toString();
      const path = `/articles/mine${query ? `?${query}` : ""}`;
      try {
        const result = await apiFull<ArticleRow[]>(path);
        setArticles(
          result.data.map((row) => ({
            ...row.article,
            authorName: row.author?.name,
          })),
        );
        if (result.pagination) setPagination(result.pagination);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to load articles";
        setError(message);
        if (showLoading) setArticles([]);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [viewAll, month, page, limit],
  );

  // silent refresh for polling (no loading spinner)
  const refreshSilently = useCallback(async () => {
    const params = new URLSearchParams();
    if (viewAll) {
      params.set("viewAll", "true");
      params.set("page", String(page ?? 1));
      params.set("limit", String(limit));
    } else if (month) params.set("month", month);
    const path = `/articles/mine${params.toString() ? `?${params.toString()}` : ""}`;
    try {
      const result = await apiFull<ArticleRow[]>(path);
      setArticles(
        result.data.map((row) => ({
          ...row.article,
          authorName: row.author?.name,
        })),
      );
      if (result.pagination) setPagination(result.pagination);
    } catch (e) {
      console.error("poll refresh failed", e);
    }
  }, [viewAll, month, page, limit]);

  useEffect(() => {
    fetchArticles(true);
  }, [fetchArticles]);

  const hasPending = articles.some(
    (a) =>
      a.status === "pending" ||
      a.status === "processing" ||
      (a.ai_score === null && a.status !== "failed"),
  );

  useEffect(() => {
    const clear = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
    if (!hasPending) {
      pollStartRef.current = null;
      clear();
      try {
        sessionStorage.removeItem("toastError");
      } catch {}
      return;
    }
    if (document.visibilityState === "hidden") {
      clear();
      return;
    }

    if (pollStartRef.current === null) pollStartRef.current = Date.now();
    const checkTimeout = () => {
      if (
        pollStartRef.current !== null &&
        Date.now() - pollStartRef.current > MAX_POLL_DURATION
      ) {
        clear();
        pollStartRef.current = null;
        try {
          sessionStorage.setItem("toastError", "Scoring timed out");
        } catch {}
        return true;
      }
      return false;
    };
    setIsPolling(true);
    intervalRef.current = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (checkTimeout()) return;
      refreshSilently();
    }, POLLING_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === "visible" && hasPending) {
        if (!intervalRef.current) {
          intervalRef.current = window.setInterval(
            () => refreshSilently(),
            POLLING_INTERVAL,
          );
          setIsPolling(true);
        }
        refreshSilently();
      } else if (document.visibilityState === "hidden") {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsPolling(false);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clear();
    };
  }, [hasPending, refreshSilently]);

  // stop when all terminal
  useEffect(() => {
    if (articles.length > 0 && !hasPending && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setIsPolling(false);
    }
  }, [articles, hasPending]);

  return {
    articles,
    loading,
    error,
    pagination,
    isPolling,
    refetch: fetchArticles,
  };
}
