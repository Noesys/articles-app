import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import {
  ChevronLeft,
  Edit3,
  X,
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useArticle } from "../hooks/useArticle";
import { api } from "../http-client";
import "react-resizable/css/styles.css";
import { useAuth } from "@/contexts/AuthContext";
import AdminHeader from "@/admin/components/AdminHeader";
import ParameterResultsBox from "@/admin/components/articles/ParameterResultsBox";
import ScoringHistoryTable from "@/admin/components/articles/ScoringHistoryTable";
import FeedbackBlock from "@/admin/components/articles/FeedbackBlock";
import CopyButton from "@/admin/utils/CopyButton";
import { ArticleDetailResponse } from "@/utils/types";
import { DownloadMarkdownButton } from "@/admin/utils/DownloadMarkdown";
import ArticleCopyButton from "@/admin/utils/ArticleCopyButton";
import { serializeArticleContent } from "@/utils/serializeArticleContent";
import { countWords } from "@/utils/countWords";
import { FilterSelect } from "@/components/ui/filter-select";
import MarkdownContent from "@/components/markdown/MarkdownContent";

const TiptapEditor = lazy(() => import("@/components/editor/TiptapEditor"));
const ArticleViewer = lazy(
  () => import("@/components/shadcnEditor/ArticleViewer"),
);

function EditorFallback() {
  return (
    <div className="min-h-[200px] flex items-center justify-center rounded-sm border border-slate-200 bg-white">
      <Loader2 size={22} className="animate-spin text-slate-400" />
    </div>
  );
}

function formatAiScore(s: number) {
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

function navigateBackOrToArticles(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/");
}

import { getDetailScoreColor, sanitizeFilename } from "@/utils/scoreColor";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
function getScoreTextColor(score: number | null, status: string, passThreshold: number | null) {
  if (score === null) return "text-slate-900";
  return getDetailScoreColor(score, passThreshold, status).text;
}

export default function ArticleDetail() {
  const { user } = useAuth();
  const { id, version: routeVersion } = useParams<{
    id: string;
    version?: string;
  }>();
  const [editorView, setEditorView] = useState<
    "editor" | "preview" | "instructions"
  >("editor");
  const [instructionsText, setInstructionsText] = useState<string | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryVersion = searchParams.get("version");
  const rawVersion = routeVersion ?? queryVersion;
  const parsedVersion = rawVersion ? parseInt(rawVersion, 10) : null;
  const versionParam =
    parsedVersion !== null && !isNaN(parsedVersion) ? parsedVersion : null;

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
  const isAdmin = user?.auth_role === "admin";
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [contentCollapsed, setContentCollapsed] = useState(true);

  // Admin-only: quick title edit (PATCH, no version bump — distinct from Rewrite)
  // and article-type change / manual re-evaluate, mirroring AdminArticleDetail.
  const [articleTypes, setArticleTypes] = useState<{ id: string; name: string }[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [typeBusy, setTypeBusy] = useState(false);
  const [reevalBusy, setReevalBusy] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleBusy, setTitleBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  /** True once an admin explicitly (re)starts scoring — distinct from a merely-pending, not-yet-scored article. */
  const [awaitingReeval, setAwaitingReeval] = useState(false);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setSelectedTypeId(article.article_type_id);
    }
  }, [article]);

  const isVersionSnapshot =
    versionParam !== null &&
    history.some((h) => h.version === versionParam) &&
    versionParam !== article?.version;
  // If version param matches a history entry, show snapshot; if it equals current version treat as live
  const snapshot =
    versionParam !== null
      ? (history.find((h) => h.version === versionParam) ?? null)
      : null;
  const effectiveSnapshot = isVersionSnapshot ? snapshot : null;
  const displayTitle = effectiveSnapshot?.title ?? article?.title ?? "";
  const displayScore = effectiveSnapshot
    ? effectiveSnapshot.score
    : currentScore;
  const displayFeedback = effectiveSnapshot
    ? (effectiveSnapshot.feedback ?? "")
    : (currentFeedback ?? "");
  const displayStatus =
    effectiveSnapshot?.status ?? article?.status ?? "pending";
  const displaySubmittedAt = effectiveSnapshot?.submitted_at ?? null;
  const displayTypeName =
    effectiveSnapshot?.article_type_name ?? article?.article_type_name ?? "";

  const isFailed = displayStatus === "failed";

  // Poll every 2.5s while scoring; stops on terminal status/complete/timeout
  const TERMINAL_STATUSES = ["approved", "failed", "rewrite_required"];
  const POLLING_INTERVAL = 2500;
  // Matches the backend's sweepStuckEvaluations threshold (index.ts) and
  // AdminArticleDetail/MyArticles polling — kept consistent so the article
  // is actually marked "failed" (rewrite enabled) by the time this gives up.
  const MAX_POLL_DURATION = 120000;
  useEffect(() => {
    if (
      effectiveSnapshot ||
      !article ||
      currentScore !== null ||
      TERMINAL_STATUSES.includes(article.status) ||
      // Admin's "change type only" leaves the article pending+unscored
      // without starting a background job — don't poll for that.
      (isAdmin && !awaitingReeval)
    )
      return;
    let stopped = false;
    let timer: number | null = null;
    const pollStart = Date.now();
    const isTimedOut = () => Date.now() - pollStart > MAX_POLL_DURATION;
    // Non-admins can land here with a pending, unscored article that has no
    // evaluation actually running (e.g. an admin changed its type without
    // re-evaluating) — the backend has no field distinguishing that from a
    // genuinely in-flight evaluation, so this message stays neutral instead
    // of claiming scoring was in progress.
    const timeoutMessage = "Still pending — refresh to check for updates";
    const tick = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      if (isTimedOut()) {
        if (timer) clearInterval(timer);
        setAwaitingReeval(false);
        try {
          sessionStorage.setItem("toastError", timeoutMessage);
        } catch {}
        return;
      }
      try {
        const result = await api<ArticleDetailResponse>(
          `/articles/mine/${article.id}`,
        );
        setArticle(result.article);
        setHistory(result.history ?? []);
        setCurrentScore(result.current_score);
        setCurrentFeedback(result.current_feedback ?? "");
        setParameterResults(result.parameter_results ?? []);
        if (result.current_score !== null) {
          setAwaitingReeval(false);
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
        setAwaitingReeval(false);
        try {
          sessionStorage.setItem("toastError", timeoutMessage);
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
  }, [article?.id, currentScore, effectiveSnapshot, isAdmin, awaitingReeval]);

  // "Not scored yet" (admin's type-only change, no reeval running) is
  // distinct from "actively scoring" — everyone else's "pending" always
  // means the latter, since only the admin type-change flow can produce it.
  const isPendingUnscored =
    isAdmin &&
    !effectiveSnapshot &&
    !awaitingReeval &&
    displayStatus === "pending" &&
    displayScore === null;
  const isPending =
    currentScore === null && article?.status === "pending" && !isPendingUnscored;

  const wordCount = countWords(content);
  const isWordCountValid = wordCount >= 1000;
  const wordCountColor = isWordCountValid ? "text-emerald-600" : wordCount >= 500 ? "text-amber-600" : "text-slate-500";
  const [feedbackCollapsed, setFeedbackCollapsed] = useState(true);
  const [passThreshold, setPassThreshold] = useState<number | null>(null);
  useEffect(() => {
    if (!article?.article_type_id) return;
    // Admins get /admin/article-types (superset — includes non-evaluatable
    // types like "Not suitable", needed for the type-change dropdown below).
    const path = isAdmin ? "/admin/article-types" : "/article-types";
    api<any>(path).then((types: any) => {
      const list = Array.isArray(types) ? types : types?.data ?? [];
      const t = list.find((x: any) => x.id === article.article_type_id);
      if (t?.pass_threshold != null) setPassThreshold(t.pass_threshold);
      const instr = (t?.general_instructions as string | null | undefined)?.trim();
      setInstructionsText(instr || null);
      setArticleTypes(
        list
          .map((x: any) => ({ id: x.id, name: x.name }))
          .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)),
      );
    }).catch(() => {});
  }, [article?.article_type_id, isAdmin]);

  async function handleSubmitRewrite() {
    if (!article) return;
    if (!title.trim() || !content.trim()) {
      setSubmitError("Title and content are required");
      return;
    }
    if (countWords(content) < 1000) {
      setSubmitError("Article must contain at least 1000 words");
      return;
    }
    if (isUploadingImages) {
      setSubmitError("Please wait for image uploads to finish before submitting");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      await api(`/articles`, {
        method: "POST",
        body: JSON.stringify({
          id: article.id,
          article_type_id: selectedTypeId || article.article_type_id,
          title: title.trim(),
          content: serializeArticleContent(content.trim()),
        }),
      });
      try {
        sessionStorage.setItem(
          "toast",
          "Article rewrite submitted! Scoring in progress...",
        );
      } catch {}
      navigate(
        user?.auth_role === "admin"
          ? "/admin/my-article"
          : "/",
      );
    } catch (err) {
      console.error("Rewrite submission failed:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit rewrite",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveTitle(nextTitle: string) {
    if (!id) return;
    const trimmed = nextTitle.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      toast.error("Title is required");
      return;
    }
    if (trimmed === article?.title) {
      setEditingTitle(false);
      return;
    }
    setTitleBusy(true);
    try {
      const res: any = await api(`/admin/articles/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: trimmed }),
      });
      const updatedTitle = (res?.article?.title as string | undefined) ?? trimmed;
      setArticle((prev) => (prev ? { ...prev, title: updatedTitle } : prev));
      setTitle(updatedTitle);
      setEditingTitle(false);
      toast.success("Title updated");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTitleBusy(false);
    }
  }

  async function handleSaveTitle() {
    await saveTitle(titleDraft);
  }

  async function handleApplySuggestedTitle() {
    if (!article?.suggested_title) return;
    setApplyBusy(true);
    try {
      await saveTitle(article.suggested_title);
    } finally {
      setApplyBusy(false);
    }
  }

  function startEditTitle() {
    setTitleDraft(article?.title ?? "");
    setEditingTitle(true);
  }

  function cancelEditTitle() {
    setEditingTitle(false);
    setTitleDraft(article?.title ?? "");
  }

  /** Refresh from the user-scoped endpoint (not useArticle's own refetch — that flips the page-level loading flag and flashes a full-screen spinner). */
  async function refreshArticleQuietly() {
    if (!id) return;
    const result = await api<ArticleDetailResponse>(`/articles/mine/${id}`);
    setArticle(result.article);
    setHistory(result.history ?? []);
    setParameterResults(result.parameter_results ?? []);
    return result;
  }

  async function handleChangeType(reevaluate: boolean) {
    if (!id || !selectedTypeId) return;
    setTypeBusy(true);
    try {
      const res: any = await api(`/admin/articles/${id}/type`, {
        method: "PATCH",
        body: JSON.stringify({ article_type_id: selectedTypeId, reevaluate }),
      });
      const started = Boolean(res?.reevaluate);
      toast.success(started ? "Type updated — re-evaluation started" : "Article type updated");
      await refreshArticleQuietly();
      setCurrentScore(null);
      setCurrentFeedback("");
      setAwaitingReeval(started);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setTypeBusy(false);
    }
  }

  async function handleReevaluate() {
    if (!id) return;
    setReevalBusy(true);
    try {
      await api(`/admin/articles/${id}/reevaluate`, { method: "POST" });
      toast.success("Re-evaluation started");
      setCurrentScore(null);
      setCurrentFeedback("");
      setAwaitingReeval(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setReevalBusy(false);
    }
  }

  /** User-side equivalent of the admin "Re-evaluate" button — resubmits the
   * article unchanged (same content/title) once the backend considers the
   * current pending attempt stale (see STUCK_EVALUATION_THRESHOLD_MS on the
   * server), so a hung/abandoned evaluation can be retried without editing.
   * Stays on this page and restarts polling, instead of navigating away
   * like a real rewrite-with-changes does. */
  async function handleUserReevaluate() {
    if (!article || isUploadingImages) return;
    setReevalBusy(true);
    try {
      await api(`/articles`, {
        method: "POST",
        body: JSON.stringify({
          id: article.id,
          article_type_id: article.article_type_id,
          title: article.title,
          content: serializeArticleContent(article.content),
        }),
      });
      toast.success("Re-evaluation started");
      setCurrentScore(null);
      setCurrentFeedback("");
      setAwaitingReeval(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setReevalBusy(false);
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

          <button
            onClick={() => navigate("/")}
            className="text-sm text-teal-600 hover:underline"
          >
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  const hasScore = displayScore !== null;
  const typeChanged = Boolean(selectedTypeId && selectedTypeId !== article?.article_type_id);
  const suggestionMatchesTitle =
    !!article?.suggested_title && article.suggested_title.trim() === (article?.title ?? "").trim();

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
            <span className="text-xs px-2.5 py-1 rounded-sm bg-amber-100 text-amber-700 font-medium">
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
          <div className="mb-4 rounded-sm bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin shrink-0" />
              Processing your submission. Scoring is running in the
              background and may take up to 2 minutes. Please wait before
              trying again.
            </span>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => void handleUserReevaluate()}
                disabled={reevalBusy || isUploadingImages}
                className="shrink-0 rounded-sm border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-40"
              >
                {reevalBusy ? "Starting…" : "Re-evaluate"}
              </button>
            )}
          </div>
        )}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            {editing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                className="flex-1 bg-white text-sm font-medium rounded-sm border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            ) : editingTitle ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveTitle();
                  }
                  if (e.key === "Escape") cancelEditTitle();
                }}
                disabled={titleBusy}
                className="flex-1 min-w-[220px] text-2xl font-semibold text-slate-900 leading-snug rounded-sm border border-border px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                autoFocus
              />
            ) : (
              <div className="flex items-start gap-2">
                <h1 className="text-2xl font-semibold text-slate-900 leading-snug">
                  {displayTitle}
                </h1>
                {isAdmin && !effectiveSnapshot && !editing && (
                  <button
                    type="button"
                    onClick={startEditTitle}
                    disabled={titleBusy || applyBusy || isPending}
                    className="mt-1 inline-flex items-center gap-1 rounded-sm border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    title="Edit title"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                )}
              </div>
            )}

            {effectiveSnapshot ? null : editingTitle ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={titleBusy}
                  onClick={() => void handleSaveTitle()}
                  className="inline-flex items-center gap-1 rounded-sm bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {titleBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save
                </button>
                <button
                  type="button"
                  disabled={titleBusy}
                  onClick={cancelEditTitle}
                  className="inline-flex items-center gap-1 rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            ) : isPending ? (
              <span className="text-xs px-3 py-2 rounded-sm bg-amber-100 text-amber-700 font-medium">
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
                      setSelectedTypeId(article.article_type_id);
                    }

                    setSubmitError(null);
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium bg-white text-slate-700 border border-slate-200 rounded-sm px-3 py-2 transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>

                <button
                  onClick={handleSubmitRewrite}
                  disabled={submitting || isUploadingImages}
                  title={isUploadingImages ? "Waiting for image uploads to finish…" : undefined}
                  className="flex items-center gap-1.5 text-sm font-medium bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-sm px-3 py-2 transition-colors"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Submit Rewrite
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditing(true);
                  setContentCollapsed(false);
                }}
                disabled={isPendingUnscored}
                className="flex items-center gap-1.5 text-sm font-medium bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-sm px-3 py-2 transition-colors shrink-0"
              >
                <Edit3 size={14} />
                Rewrite Article
              </button>
            )}
          </div>

          {editing && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2.5">
              <label className="text-xs font-medium text-slate-500 shrink-0">
                Article type
              </label>
              <FilterSelect
                value={selectedTypeId}
                onValueChange={setSelectedTypeId}
                options={articleTypes.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select type"
                className="min-w-[220px] max-w-[320px]"
                disabled={submitting}
              />
              {typeChanged && (
                <span className="text-xs text-amber-700">
                  Type will change when you submit — re-evaluated against the new type's criteria.
                </span>
              )}
            </div>
          )}

          {isAdmin && !effectiveSnapshot && article?.suggested_title && (
            <div className="mt-3 rounded-sm border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                AI suggested title
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-800 flex-1 min-w-0">{article.suggested_title}</p>
                <button
                  type="button"
                  disabled={
                    applyBusy || titleBusy || suggestionMatchesTitle || editingTitle || editing
                  }
                  onClick={() => void handleApplySuggestedTitle()}
                  className="rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
                >
                  {applyBusy ? "Applying…" : suggestionMatchesTitle ? "Applied" : "Apply"}
                </button>
              </div>
            </div>
          )}
        </div>

        {isAdmin && !effectiveSnapshot && (
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm mb-6">
            <p className="text-md font-semibold uppercase tracking-wide text-slate-600 mb-3">
              Article type
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <FilterSelect
                value={selectedTypeId}
                onValueChange={setSelectedTypeId}
                options={articleTypes.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select type"
                className="min-w-[240px] max-w-[320px]"
                disabled={typeBusy || reevalBusy || isPending || editing}
              />
              <button
                type="button"
                disabled={!typeChanged || typeBusy || reevalBusy || isPending || editing}
                onClick={() => handleChangeType(true)}
                className="rounded-sm bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {typeBusy ? "Saving…" : "Change type & re-evaluate"}
              </button>
              <button
                type="button"
                disabled={!typeChanged || typeBusy || reevalBusy || isPending || editing}
                onClick={() => handleChangeType(false)}
                className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                Change type only
              </button>
              <button
                type="button"
                disabled={typeBusy || reevalBusy || isPending || editing || !!typeChanged}
                onClick={handleReevaluate}
                className="rounded-sm border border-border px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                {reevalBusy ? "Starting…" : isPending ? "Scoring…" : "Re-evaluate"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Changing type snapshots the prior score (if any). Not suitable skips AI scoring.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* Current Score */}
          <div className="rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-md font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Current Score
            </p>

            <div className="flex items-center gap-3 w-full">
              <div className="flex items-center gap-3 flex-1">
                {isFailed ? (
                  <div className="py-2">
                    <p className="font-medium text-red-600">
                      Evaluation failed
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      We couldn't evaluate this article. Please submit it again.
                    </p>
                  </div>
                ) : isPendingUnscored ? (
                  <p className="text-sm text-slate-500 py-1">
                    Not scored yet — use Re-evaluate to run scoring.
                  </p>
                ) : displayScore === null ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                    <Loader2
                      size={16}
                      className="animate-spin text-slate-400"
                    />
                    <span>Scoring...</span>
                  </div>
                ) : (
                  <>
                    <p className={`text-3xl font-semibold ${hasScore ? getScoreTextColor(displayScore, displayStatus, passThreshold) : "text-slate-900"}`}>
                      {hasScore ? formatAiScore(displayScore!) : "—"}
                      <span className="text-base text-slate-400 font-normal">
                        {" "}
                        / 10
                      </span>
                    </p>

                    {hasScore && (
                      <Progress value={Math.min(Math.max(displayScore!,0),10)*10} className={cn("flex-1 h-2", getDetailScoreColor(displayScore!, passThreshold, displayStatus).barTw)} />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Feedback - collapsible, default collapsed, matches ParameterResultsBox */}
          <div className="rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFeedbackCollapsed(!feedbackCollapsed)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setFeedbackCollapsed(!feedbackCollapsed);
                }
              }}
              className="w-full flex items-center justify-between px-4 py-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <p className="text-md font-semibold uppercase tracking-wide text-slate-600">Feedback</p>
              <div className="flex items-center gap-2">
                {displayFeedback && <span onClick={(e) => e.stopPropagation()}><CopyButton text={displayFeedback} /></span>}
                <span className="p-1 text-slate-400">
                  {feedbackCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </span>
              </div>
            </div>
            {!feedbackCollapsed && (
              <div className="px-4 pb-4">
                {isFailed ? (
                  <p className="text-sm text-red-600">Evaluation failed. Please submit it again.</p>
                ) : isPendingUnscored ? (
                  <p className="text-sm text-slate-500">No feedback yet.</p>
                ) : displayScore === null ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-2 bg-white p-4 rounded-sm border border-slate-200 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                    <span>Scoring...</span>
                  </div>
                ) : (
                  <FeedbackBlock feedback={displayFeedback || "No feedback available yet."} />
                )}
              </div>
            )}
          </div>
          <ParameterResultsBox results={parameterResults} />

          {/* Content - COLLAPSIBLE */}
          <div className="bg-white border border-slate-200 rounded-sm overflow-hidden shadow-sm">
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-slate-100 cursor-pointer"
              onClick={() => setContentCollapsed(!contentCollapsed)}
            >
              <h2 className="font-semibold text-slate-900">Article</h2>

              <div className="flex items-center gap-2">
                {article && (
                  <div className="flex items-center">
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 rounded-sm px-2.5 py-1">
                      {displayTypeName}
                    </span>
                      <ArticleCopyButton title={title} text={content} />
                    <DownloadMarkdownButton
                      title={title}
                      content={content}
                      filename={sanitizeFilename(displayTitle || title)}
                    />
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
                {editing ? (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex bg-slate-100 rounded-sm p-0.5 w-fit">
                        <button
                          type="button"
                          onClick={() => setEditorView("editor")}
                          className={`px-3 py-1 text-xs font-medium rounded-md ${
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
                          className={`px-3 py-1 text-xs font-medium rounded-md ${
                            editorView === "preview"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          Preview
                        </button>
                        {instructionsText && (
                          <button
                            type="button"
                            onClick={() => setEditorView("instructions")}
                            className={`px-3 py-1 text-xs font-medium rounded-md ${
                              editorView === "instructions"
                                ? "bg-white text-slate-900 shadow-sm"
                                : "text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            Instructions
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs">
                        <span className={wordCountColor}>Word count: {wordCount}</span>
                        {isWordCountValid && (
                          <>
                            <CheckCircle2
                              size={12}
                              className="text-emerald-600"
                            />
                            <span className="text-emerald-600">
                              Ready to submit
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Suspense fallback={<EditorFallback />}>
                      {editorView === "editor" && (
                        <TiptapEditor
                          value={content}
                          onChange={setContent}
                          onUploadingChange={setIsUploadingImages}
                        />
                      )}
                      {editorView === "preview" && (
                        <ArticleViewer content={content} />
                      )}
                      {editorView === "instructions" && instructionsText && (
                        <div className="min-h-[200px] rounded-sm border border-slate-200 bg-white p-4 shadow-sm">
                          <MarkdownContent>{instructionsText}</MarkdownContent>
                        </div>
                      )}
                    </Suspense>
                  </div>
                ) : (
                  <Suspense fallback={<EditorFallback />}>
                    <ArticleViewer content={content} />
                  </Suspense>
                )}

                {submitError && (
                  <p className="mt-3 text-sm text-red-600">{submitError}</p>
                )}
              </div>
            )}
          </div>

          {!effectiveSnapshot && (
            <ScoringHistoryTable
              isAdmin={false}
              history={history}
              articleId={article?.id ?? ""}
            />
          )}
        </div>
      </div>
    </div>
  );
}