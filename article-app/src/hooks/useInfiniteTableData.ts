import { useCallback, useEffect, useRef, useState } from "react";

export interface FetchPageResult<TRow> {
  data: TRow[];
  total: number;
}

export interface UseInfiniteTableDataOptions<
  TRow,
  TParams extends Record<string, unknown>,
> {
  /** Fetches one page. `params` is spread in alongside page/limit as-is — add fields freely. */
  fetchPage: (
    args: { page: number; limit: number } & TParams,
  ) => Promise<FetchPageResult<TRow>>;
  /** Any change (deep, via JSON.stringify) resets the accumulated rows and refetches from page 1. */
  params: TParams;
  /** Rows requested per fetchPage() call. A change also resets to page 1. */
  limit: number;
}

export interface UseInfiniteTableDataResult<TRow> {
  rows: TRow[];
  total: number;
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  error: string | null;
  fetchMore: () => void;
  /** Hard reset: clears rows and refetches from page 1, with the initial-loading flag. */
  refetch: () => void;
  /**
   * Re-fetches every currently-loaded row in a single call (page 1, limit =
   * loadedPages * limit) and swaps them in place, without touching how many
   * pages are considered loaded. Silent mode skips the isLoading flag and
   * error surfacing — for background refresh (e.g. polling) that shouldn't
   * flash the loading state or disrupt scroll position.
   */
  refetchLoaded: (options?: { silent?: boolean }) => void;
}

export function useInfiniteTableData<
  TRow,
  TParams extends Record<string, unknown>,
>({
  fetchPage,
  params,
  limit,
}: UseInfiniteTableDataOptions<TRow, TParams>): UseInfiniteTableDataResult<TRow> {
  const [rows, setRows] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const limitRef = useRef(limit);
  limitRef.current = limit;

  const loadedPageRef = useRef(0);
  const requestIdRef = useRef(0);
  const paramsKey = JSON.stringify(params);

  const runFetch = useCallback((page: number, mode: "initial" | "more") => {
    const requestId = ++requestIdRef.current;
    if (mode === "initial") {
      setIsLoading(true);
      setError(null);
    } else {
      setIsFetchingMore(true);
    }

    fetchPageRef
      .current({ page, limit: limitRef.current, ...paramsRef.current })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setRows((prev) =>
          mode === "more" ? [...prev, ...result.data] : result.data,
        );
        setTotal(result.total);
        loadedPageRef.current = page;
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
        if (mode === "initial") setRows([]);
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        if (mode === "initial") setIsLoading(false);
        else setIsFetchingMore(false);
      });
  }, []);

  useEffect(() => {
    loadedPageRef.current = 0;
    setRows([]);
    setTotal(0);
    runFetch(1, "initial");
    // paramsKey stands in for every field of params (deep-compared via
    // JSON.stringify) so new filters need no edits here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, limit, runFetch]);

  const fetchMore = useCallback(() => {
    if (isLoading || isFetchingMore) return;
    if (rows.length >= total) return;
    runFetch(loadedPageRef.current + 1, "more");
  }, [isLoading, isFetchingMore, rows.length, total, runFetch]);

  const refetch = useCallback(() => {
    loadedPageRef.current = 0;
    setRows([]);
    setTotal(0);
    runFetch(1, "initial");
  }, [runFetch]);

  const refetchLoaded = useCallback((options?: { silent?: boolean }) => {
    const pagesLoaded = Math.max(1, loadedPageRef.current || 1);
    const combinedLimit = pagesLoaded * limitRef.current;
    const requestId = ++requestIdRef.current;
    const silent = options?.silent ?? false;

    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    fetchPageRef
      .current({ page: 1, limit: combinedLimit, ...paramsRef.current })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setRows(result.data);
        setTotal(result.total);
        // loadedPageRef stays at pagesLoaded — this re-fetched the same
        // window of data, it didn't advance it.
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        if (silent) {
          console.error("Silent refresh failed:", err);
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load data");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        if (!silent) setIsLoading(false);
      });
  }, []);

  const hasMore = !isLoading && rows.length < total;

  return {
    rows,
    total,
    isLoading,
    isFetchingMore,
    hasMore,
    error,
    fetchMore,
    refetch,
    refetchLoaded,
  };
}
