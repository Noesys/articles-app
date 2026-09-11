import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import { ChevronLeft, Edit3, X, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import dayjs from "dayjs";
import { useArticle } from "../hooks/useArticle";
import { api } from "../http-client";
import "react-resizable/css/styles.css";
import { useAuth } from "@/contexts/AuthContext";
import AdminHeader from "@/admin/components/AdminHeader";
import ArticleViewer from "@/components/shadcnEditor/ArticleViewer";
import TiptapEditor from "@/components/editor/TiptapEditor";
import ParameterResultsBox from "@/admin/components/articles/ParameterResultsBox";
import ScoringHistoryTable from "@/admin/components/articles/ScoringHistoryTable";
import FeedbackBlock from "@/admin/components/articles/FeedbackBlock";
import CopyButton from "@/admin/utils/CopyButton";
import { ArticleDetailResponse } from "@/utils/types";
import { DownloadMarkdownButton } from "@/admin/utils/DownloadMarkdown";
import ArticleCopyButton from "@/admin/utils/ArticleCopyButton";

function formatAiScore(s: number) {
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

function navigateBackOrToArticles(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/");
}

function getScoreBarColor(status: string) {
  if (status === "approved") return "bg-emerald-500";
  if (status === "rewrite_required" || status === "failed") return "bg-red-500";
  return "bg-amber-500";
}

export default function ArticleDetail() {
  const { user } = useAuth();
  const { id, version: routeVersion } = useParams<{
    id: string;
    version?: string;
  }>();
  const [editorView, setEditorView] = useState<"editor" | "preview">("editor");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryVersion = searchParams.get("version");
  const rawVersion = routeVersion ?? queryVersion;
  const parsedVersion = rawVersion ? parseInt(rawVersion, 10) : null;
  const versionParam = parsedVersion !== null && !isNaN(parsedVersion) ? parsedVersion : null;

  const {
    article,
    history,
    currentScore,
    currentFeedback,
    loading,
    error,
    parameterResults,
    setCurrentScore,
    setCurrentFeedback,
    setArticle,
    setParameterResults,
    setHistory,
  } = useArticle(id ?? "");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contentCollapsed, setContentCollapsed] = useState(true);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
    }
  }, [article]);

  const isVersionSnapshot =
    versionParam !== null &&
    history.some((h) => h.version === versionParam) &&
    versionParam !== article?.version;
  // If version param matches a history entry, show snapshot; if it equals current version treat as live
  const snapshot =
    versionParam !== null ? (history.find((h) => h.version === versionParam) ?? null) : null;
  const effectiveSnapshot = isVersionSnapshot ? snapshot : null;
  const displayTitle = effectiveSnapshot?.title ?? article?.title ?? "";
  const displayScore = effectiveSnapshot ? effectiveSnapshot.score : currentScore;
  const displayFeedback = effectiveSnapshot
    ? (effectiveSnapshot.feedback ?? "")
    : (currentFeedback ?? "");
  const displayStatus = effectiveSnapshot?.status ?? article?.status ?? "pending";
  const displaySubmittedAt = effectiveSnapshot?.submitted_at ?? null;

  const isFailed = displayStatus === "failed";

  // Poll every 2.5s while scoring; stops on terminal status/complete/timeout
  const TERMINAL_STATUSES = ["approved", "failed", "rewrite_required"];
  const POLLING_INTERVAL = 2500;
  const MAX_POLL_DURATION = 300000;
  useEffect(() => {
    if (
      effectiveSnapshot ||
      !article ||
      currentScore !== null ||
      TERMINAL_STATUSES.includes(article.status)
    )
      return;
    let stopped = false;
    let timer: number | null = null;
    const pollStart = Date.now();
    const isTimedOut = () => Date.now() - pollStart > MAX_POLL_DURATION;
    const tick = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      if (isTimedOut()) {
        if (timer) clearInterval(timer);
        try {
          sessionStorage.setItem("toastError", "Scoring timed out");
        } catch {}
        return;
      }
      try {
        const result = await api<ArticleDetailResponse>(`/articles/mine/${article.id}`);
        setArticle(result.article);
        setHistory(result.history ?? []);
        setCurrentScore(result.current_score);
        setCurrentFeedback(result.current_feedback ?? "");
        setParameterResults(result.parameter_results ?? []);
        if (result.current_score !== null) {
          try {
            sessionStorage.removeItem("toastError");
          } catch {}
          if (timer) clearInterval(timer);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    };
    timer = window.setInterval(() => {
      if (isTimedOut()) {
        if (timer) clearInterval(timer);
        try {
          sessionStorage.setItem("toastError", "Scoring timed out");
        } catch {}
        return;
      }
      tick();
    }, POLLING_INTERVAL);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [article?.id, currentScore, effectiveSnapshot]);

  const isPending = currentScore === null && article?.status === "pending";

  async function handleSubmitRewrite() {
    if (!article) return;
    if (!title.trim() || !content.trim()) {
      setSubmitError("Title and content are required");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      await api(`/articles`, {
        method: "POST",
        body: JSON.stringify({
          id: article.id,
          article_type_id: article.article_type_id,
          title: title.trim(),
          content: content.trim(),
        }),
      });
      try {
        sessionStorage.setItem("toast", "Article rewrite submitted! Scoring in progress...");
      } catch {}
      navigate(
        user?.auth_role === "admin" || user?.auth_role === "super_admin"
          ? "/admin/my-article"
          : "/",
      );
    } catch (err) {
      console.error("Rewrite submission failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to submit rewrite");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{error}</p>

          <button onClick={() => navigate("/")} className="text-sm text-indigo-600 hover:underline">
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  const hasScore = displayScore !== null;

  return (
    <div className="min-h-screen bg-slate-50">
      {user?.auth_role === "user" ? <Header /> : <AdminHeader />}

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
        {isPending && !effectiveSnapshot && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Processing your submission — scoring in
            background...
          </div>
        )}
        <div className="flex items-start justify-between gap-4 mb-6">
          {editing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title"
              className="flex-1 bg-white text-sm font-medium rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <h1 className="text-2xl font-semibold text-slate-900 leading-snug">{displayTitle}</h1>
          )}

          {effectiveSnapshot ? null : isPending ? (
            <span className="text-xs px-3 py-2 rounded-lg bg-amber-100 text-amber-700 font-medium">
              Scoring — edits disabled
            </span>
          ) : editing ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setEditing(false);

                  if (article) {
                    setTitle(article.title);
                    setContent(article.content);
                  }

                  setSubmitError(null);
                }}
                className="flex items-center gap-1.5 text-sm font-medium bg-white text-slate-700 border border-slate-300 rounded-lg px-3 py-2 transition-colors"
              >
                <X size={14} />
                Cancel
              </button>

              <button
                onClick={handleSubmitRewrite}
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg px-3 py-2 transition-colors"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Submit Rewrite
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditing(true);
                setContentCollapsed(false);
              }}
              className="flex items-center gap-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 transition-colors shrink-0"
            >
              <Edit3 size={14} />
              Rewrite Article
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* Current Score */}
          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
            <p className="text-md font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Current Score
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                {isFailed ? (
                  <div className="py-2">
                    <p className="font-medium text-red-600">Evaluation failed</p>
                    <p className="text-sm text-slate-500 mt-1">
                      We couldn't evaluate this article. Please rewrite the article and submit it
                      again.
                    </p>
                  </div>
                ) : displayScore === null ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                    <span>Scoring...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-3xl font-semibold text-slate-900">
                      {hasScore ? formatAiScore(displayScore!) : "—"}
                      <span className="text-base text-slate-400 font-normal"> / 10</span>
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
          </div>

          {/* Feedback */}
          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-md font-semibold uppercase tracking-wide text-slate-600">
                Feedback
              </p>

              {displayFeedback && <CopyButton text={displayFeedback} />}
            </div>

            {isFailed ? (
              <p className="text-sm text-red-600">
                Evaluation failed. Please rewrite the article and submit it again.
              </p>
            ) : displayScore === null ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2 bg-white p-4 rounded-lg border border-slate-300 shadow-sm">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span>Scoring...</span>
              </div>
            ) : (
              <FeedbackBlock feedback={displayFeedback || "No feedback available yet."} />
            )}
          </div>
          <ParameterResultsBox results={parameterResults} />

          {/* Content - COLLAPSIBLE */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
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
                    <ArticleCopyButton title={title} text={content} />
                    <DownloadMarkdownButton
                      title={title}
                      content={content}
                      filename="article-review.md"
                    />
                  </div>
                )}
                <span className="p-1 text-slate-400">
                  {contentCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </span>
              </div>
            </div>

            {!contentCollapsed && (
              <div className="px-5 py-4">
                {editing ? (
                  <div>
                    <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
                      <button
                        type="button"
                        onClick={() => setEditorView("editor")}
                        className={`px-3 py-1 text-xs font-medium rounded-lg ${
                          editorView === "editor"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorView("preview")}
                        className={`px-3 py-1 text-xs font-medium rounded-lg ${
                          editorView === "preview"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        Preview
                      </button>
                    </div>

                    <div className="mx-5">
                      {editorView === "editor" && (
                        <TiptapEditor value={content} onChange={setContent} />
                      )}
                    </div>
                    {editorView === "preview" && <ArticleViewer content={content} />}
                  </div>
                ) : (
                  <ArticleViewer content={content} />
                )}

                {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
              </div>
            )}
          </div>

          {!effectiveSnapshot && (
            <ScoringHistoryTable history={history} articleId={article?.id ?? ""} />
          )}
        </div>
      </div>
    </div>
  );
}
