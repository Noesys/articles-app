import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import dayjs from "dayjs";
import { tokenStorage } from "../../../http-client";
import ArticleViewer from "@/components/shadcnEditor/ArticleViewer";
import ScoringHistoryTable from "./ScoringHistoryTable";
import ParameterResultsBox from "./ParameterResultsBox";
import FeedbackBlock from "./FeedbackBlock";
import CopyButton from "@/admin/utils/CopyButton";
import { HistoryItem, ArticleDetail, ParameterResult } from "@/utils/types";

function formatAiScore(s: number) {
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

function navigateBackOrToArticles(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/admin/articles");
}

function getScoreBarColor(status: string) {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rewrite_required" || status === "failed") return "bg-red-500";
  return "bg-amber-500";
}

export default function AdminArticleDetail() {
  const { id, version: routeVersion } = useParams<{
    id: string;
    version?: string;
  }>();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const queryVersion = searchParams.get("version");
  const rawVersion = routeVersion ?? queryVersion;

  const parsedVersion = rawVersion ? parseInt(rawVersion, 10) : null;
  const versionParam =
    parsedVersion !== null && !isNaN(parsedVersion) ? parsedVersion : null;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState("");
  const [parameterResults, setParameterResults] = useState<ParameterResult[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contentCollapsed, setContentCollapsed] = useState(true);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const base = (
          (import.meta.env.VITE_BACKEND_URL as string | undefined) || ""
        ).replace(/\/$/, "");
        const token =
          tokenStorage.get() ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token");

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${base}/api/articles/${id}`, {
          credentials: "include",
          headers,
          signal: controller.signal,
        });

        if (cancelled || controller.signal.aborted) return;

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const text = await res.text();
          throw new Error(
            `Unexpected response (${res.status}): ${text.slice(0, 200)}`,
          );
        }
        if (!res.ok) throw new Error("Failed to load");

        const json = await res.json();
        const d = json.data;

        // Handle both admin flat shape and user nested shape
        if (d.article) {
          // user shape fallback
          setArticle(d.article as ArticleDetail);
          setHistory((d.history ?? []) as HistoryItem[]);
          setCurrentScore(d.current_score ?? d.ai_score ?? null);
          setCurrentFeedback(d.current_feedback ?? d.ai_feedback ?? "");
          setParameterResults(d.parameter_results ?? []);
        } else {
          const art: ArticleDetail = {
            id: d.id as string,
            title: d.title as string,
            content: d.content as string,
            article_type_id: (d.article_type_id as string) || "",
            article_type_name:
              (d.article_type_name as string) || (d.type as string) || "",
            status: d.status as string,
            version: d.version as number,
          };
          setArticle(art);
          setCurrentScore(d.ai_score ?? null);
          setCurrentFeedback(d.ai_feedback || "");
          setParameterResults(d.parameter_results ?? []);
          const hist = (d.history || []).map(
            (h: {
              article_id?: string;
              id?: string;
              version: number;
              title: string;
              content: string;
              ai_score?: number | null;
              score?: number | null;
              ai_feedback?: string | null;
              feedback?: string | null;
              status?: string;
              submitted_at?: string;
              snapshotted_at?: string;
            }) => ({
              article_id: h.article_id || (h.id as string) || "",
              version: h.version,
              title: h.title,
              content: h.content,
              score: h.ai_score ?? h.score ?? null,
              feedback: h.ai_feedback ?? h.feedback ?? null,
              status: h.status || "pending",
              submitted_at: (h.submitted_at ||
                h.snapshotted_at ||
                "") as string,
              snapshotted_at: h.snapshotted_at || "",
            }),
          );
          setHistory(hist as HistoryItem[]);
        }
      } catch (e: unknown) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError"))
          return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  const isVersionSnapshot =
    versionParam !== null &&
    history.some((h) => h.version === versionParam) &&
    versionParam !== article?.version;

  const snapshot =
    versionParam !== null
      ? (history.find((h) => h.version === versionParam) ?? null)
      : null;

  const effectiveSnapshot = isVersionSnapshot ? snapshot : null;
  const displayTitle = effectiveSnapshot?.title ?? article?.title ?? "";
  const displayContent = effectiveSnapshot?.content ?? article?.content ?? "";
  const displayScore = effectiveSnapshot
    ? effectiveSnapshot.score
    : currentScore;
  const displayFeedback = effectiveSnapshot
    ? (effectiveSnapshot.feedback ?? "")
    : (currentFeedback ?? "");
  const displayStatus =
    effectiveSnapshot?.status ?? article?.status ?? "pending";
  const displaySubmittedAt = effectiveSnapshot?.submitted_at ?? null;

  useEffect(() => {
    if (!id || !versionParam) return;
    const controller = new AbortController();

    (async () => {
      try {
        const base = (
          (import.meta.env.VITE_BACKEND_URL as string | undefined) || ""
        ).replace(/\/$/, "");
        const token =
          tokenStorage.get() ||
          localStorage.getItem("token") ||
          sessionStorage.getItem("token");

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `${base}/api/articles/${id}/parameter-results?version=${versionParam}`,
          {
            credentials: "include",
            headers,
            signal: controller.signal,
          },
        );

        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setParameterResults(
              json.data.map(
                (r: {
                  name?: string;
                  parameterName?: string;
                  parameter_name?: string;
                  scopeType?: string;
                  scope_type?: string;
                  value: string | number;
                }) => ({
                  parameter_name:
                    r.parameterName || r.parameter_name || r.name || "",
                  scope_type: r.scopeType || r.scope_type || "",
                  value: r.value,
                }),
              ),
            );
          }
        }
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();

    return () => controller.abort();
  }, [id, versionParam]);

  const hasScore = displayScore !== null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{error || "Article not found"}</p>

          <button
            onClick={() => navigate("/admin/articles")}
            className="text-sm text-indigo-600 hover:underline"
          >
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-4 md:px-8 py-8">
        <button
          onClick={() => navigateBackOrToArticles(navigate)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft size={14} />
          Back
        </button>

        {effectiveSnapshot && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
              Version {effectiveSnapshot.version} Snapshot
            </span>

            {displaySubmittedAt && (
              <span className="text-xs text-slate-400">
                {dayjs(displaySubmittedAt).format("MMM D, YYYY h:mm A")}
              </span>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-slate-900 leading-snug">
            {displayTitle}
          </h1>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-md font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Current Score
            </p>

            <div className="flex items-center gap-3">
              {displayScore === null ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                  <span>loading...</span>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-semibold text-slate-900">
                    {hasScore ? formatAiScore(displayScore!) : "—"}
                    <span className="text-base text-slate-400 font-normal">
                      {" "}
                      / 10
                    </span>
                  </p>

                  {hasScore && (
                    <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getScoreBarColor(displayStatus)}`}
                        style={{
                          width: `${(Math.min(displayScore!, 10) / 10) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-md font-semibold uppercase tracking-wide text-slate-600">
                Feedback
              </p>

              {displayFeedback && <CopyButton text={displayFeedback} />}
            </div>

            {displayScore === null ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span>loading...</span>
              </div>
            ) : (
              <FeedbackBlock
                feedback={displayFeedback || "No feedback available yet."}
              />
            )}
          </div>
          <ParameterResultsBox results={parameterResults} />

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-slate-100 cursor-pointer"
              onClick={() => setContentCollapsed(!contentCollapsed)}
            >
              <h2 className="font-semibold text-slate-900">Article</h2>

              <div className="flex items-center gap-2">
                {article && (
                  <div className="flex items-center">
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">
                      {article.article_type_name}
                    </span>
                    <CopyButton text={displayContent} />
                  </div>
                )}

                <span className="p-1 text-slate-400">
                  {contentCollapsed ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronUp size={18} />
                  )}
                </span>
              </div>
            </div>

            {!contentCollapsed && (
              <div className="px-5 py-4">
                <ArticleViewer content={displayContent} />
              </div>
            )}
          </div>

          {!effectiveSnapshot && (
            <ScoringHistoryTable
              history={history}
              articleId={article?.id ?? ""}
            />
          )}
        </div>
      </div>
    </div>
  );
}
