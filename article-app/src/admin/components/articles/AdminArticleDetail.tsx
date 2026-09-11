import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Loader2, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import dayjs from "dayjs";
import { api } from "../../../http-client";
import ArticleViewer from "@/components/shadcnEditor/ArticleViewer";
import ScoringHistoryTable from "./ScoringHistoryTable";
import ParameterResultsBox from "./ParameterResultsBox";
import FeedbackBlock from "./FeedbackBlock";
import CopyButton from "@/admin/utils/CopyButton";
import { HistoryItem, ArticleDetail, ParameterResult } from "@/utils/types";
import { DownloadMarkdownButton } from "@/admin/utils/DownloadMarkdown";
import ArticleCopyButton from "@/admin/utils/ArticleCopyButton";

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

type ArticleTypeOption = { id: string; name: string };

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
  const versionParam = parsedVersion !== null && !isNaN(parsedVersion) ? parsedVersion : null;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [currentFeedback, setCurrentFeedback] = useState("");
  const [parameterResults, setParameterResults] = useState<ParameterResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contentCollapsed, setContentCollapsed] = useState(true);
  const [articleTypes, setArticleTypes] = useState<ArticleTypeOption[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [typeBusy, setTypeBusy] = useState(false);
  const [reevalBusy, setReevalBusy] = useState(false);
  /** True after admin starts re-eval until score/failed/timeout — distinct from idle pending. */
  const [scoringInFlight, setScoringInFlight] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleBusy, setTitleBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);

  const applyArticlePayload = useCallback((d: any) => {
    if (d.article) {
      setArticle(d.article as ArticleDetail);
      setSelectedTypeId((d.article as ArticleDetail).article_type_id || "");
      setHistory((d.history ?? []) as HistoryItem[]);
      setCurrentScore(d.current_score ?? d.ai_score ?? null);
      setCurrentFeedback(d.current_feedback ?? d.ai_feedback ?? "");
      setParameterResults(d.parameter_results ?? []);
      return d.article as ArticleDetail;
    }

    const art: ArticleDetail = {
      id: d.id as string,
      title: d.title as string,
      content: d.content as string,
      article_type_id: (d.article_type_id as string) || "",
      article_type_name: (d.article_type_name as string) || (d.type as string) || "",
      status: d.status as string,
      version: d.version as number,
      suggested_title: (d.suggested_title as string | null | undefined) ?? null,
    };
    setArticle(art);
    setSelectedTypeId(art.article_type_id);
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
        submitted_at: (h.submitted_at || h.snapshotted_at || "") as string,
        snapshotted_at: h.snapshotted_at || "",
      }),
    );
    setHistory(hist as HistoryItem[]);
    return art;
  }, []);

  const loadArticle = useCallback(async () => {
    if (!id) return null;
    const d: any = await api(`/admin/articles/${id}`);
    return applyArticlePayload(d);
  }, [id, applyArticlePayload]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [types] = await Promise.all([
          api<ArticleTypeOption[] | { id: string; name: string }[]>(`/admin/article-types`),
          loadArticle(),
        ]);
        if (cancelled) return;
        const list = Array.isArray(types) ? types : [];
        setArticleTypes(
          list
            .map((t) => ({ id: t.id, name: t.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, loadArticle]);

  const isVersionSnapshot =
    versionParam !== null &&
    history.some((h) => h.version === versionParam) &&
    versionParam !== article?.version;

  const snapshot =
    versionParam !== null ? (history.find((h) => h.version === versionParam) ?? null) : null;

  const effectiveSnapshot = isVersionSnapshot ? snapshot : null;
  const displayTitle = effectiveSnapshot?.title ?? article?.title ?? "";
  const displayContent = effectiveSnapshot?.content ?? article?.content ?? "";
  const displayScore = effectiveSnapshot ? effectiveSnapshot.score : currentScore;
  const displayFeedback = effectiveSnapshot
    ? (effectiveSnapshot.feedback ?? "")
    : (currentFeedback ?? "");
  const displayStatus = effectiveSnapshot?.status ?? article?.status ?? "pending";
  const displaySubmittedAt = effectiveSnapshot?.submitted_at ?? null;
  const suggestedTitle = !effectiveSnapshot ? (article?.suggested_title ?? null) : null;

  const isFailed = displayStatus === "failed";
  const isScoring = scoringInFlight && !effectiveSnapshot && !isFailed && displayScore === null;
  const isPendingUnscored =
    !effectiveSnapshot && !isScoring && displayStatus === "pending" && displayScore === null;

  // Poll while an admin-triggered re-eval is in flight
  const POLLING_INTERVAL = 2500;
  const MAX_POLL_DURATION = 300000;
  useEffect(() => {
    if (!scoringInFlight || !id || effectiveSnapshot) return;

    let stopped = false;
    let timer: number | null = null;
    const pollStart = Date.now();

    const finish = (timedOut = false) => {
      setScoringInFlight(false);
      if (timedOut) toast.warning("Scoring timed out — refresh or try again");
      if (timer) clearInterval(timer);
    };

    const tick = async () => {
      if (stopped || document.visibilityState === "hidden") return;
      if (Date.now() - pollStart > MAX_POLL_DURATION) {
        finish(true);
        return;
      }
      try {
        const d: any = await api(`/admin/articles/${id}`);
        applyArticlePayload(d);
        const resolvedScore = d.current_score ?? d.ai_score ?? null;
        const status = (d.article?.status ?? d.status) as string;
        if (
          status === "failed" ||
          status === "approved" ||
          status === "rewrite_required" ||
          resolvedScore !== null
        ) {
          finish(false);
        }
      } catch (e) {
        console.error(e);
      }
    };

    void tick();
    timer = window.setInterval(() => {
      void tick();
    }, POLLING_INTERVAL);

    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [scoringInFlight, id, effectiveSnapshot, applyArticlePayload]);

  useEffect(() => {
    if (!id || !versionParam) return;
    (async () => {
      try {
        const data: any = await api(
          `/admin/articles/${id}/parameter-results?version=${versionParam}`,
        );
        const rows = Array.isArray(data) ? data : (data?.data ?? data);
        if (rows) {
          setParameterResults(
            (rows as any[]).map(
              (r: {
                name?: string;
                parameterName?: string;
                parameter_name?: string;
                scopeType?: string;
                scope_type?: string;
                value: string | number;
              }) => ({
                parameter_name: r.parameterName || r.parameter_name || r.name || "",
                scope_type: r.scopeType || r.scope_type || "",
                value: r.value,
              }),
            ),
          );
        }
      } catch {}
    })();
  }, [id, versionParam]);

  const hasScore = displayScore !== null;

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
    if (!suggestedTitle) return;
    setApplyBusy(true);
    try {
      await saveTitle(suggestedTitle);
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

  async function handleChangeType(reevaluate: boolean) {
    if (!id || !selectedTypeId) return;
    setTypeBusy(true);
    try {
      const res: any = await api(`/admin/articles/${id}/type`, {
        method: "PATCH",
        body: JSON.stringify({
          article_type_id: selectedTypeId,
          reevaluate,
        }),
      });
      const started = Boolean(res?.reevaluate);
      toast.success(started ? "Type updated — re-evaluation started" : "Article type updated");
      await loadArticle();
      setCurrentScore(null);
      setCurrentFeedback("");
      setScoringInFlight(started);
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
      await loadArticle();
      setCurrentScore(null);
      setCurrentFeedback("");
      setScoringInFlight(true);
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

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-500 mb-4">{error || "Article not found"}</p>

          <button
            onClick={() => navigate("/admin/articles")}
            className="text-sm text-teal-600 hover:underline"
          >
            Back to Articles
          </button>
        </div>
      </div>
    );
  }

  const typeChanged = selectedTypeId && selectedTypeId !== article.article_type_id;
  const suggestionMatchesTitle =
    !!suggestedTitle && suggestedTitle.trim() === (article.title ?? "").trim();

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

        <div className="mb-6">
          {!effectiveSnapshot && editingTitle ? (
            <div className="flex flex-wrap items-start gap-2">
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
                className="flex-1 min-w-[220px] text-2xl font-semibold text-slate-900 leading-snug rounded-md border border-slate-300 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                autoFocus
              />
              <button
                type="button"
                disabled={titleBusy}
                onClick={() => void handleSaveTitle()}
                className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {titleBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save
              </button>
              <button
                type="button"
                disabled={titleBusy}
                onClick={cancelEditTitle}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <h1 className="text-2xl font-semibold text-slate-900 leading-snug">{displayTitle}</h1>
              {!effectiveSnapshot && (
                <button
                  type="button"
                  onClick={startEditTitle}
                  disabled={titleBusy || applyBusy || scoringInFlight}
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  title="Edit title"
                >
                  <Pencil size={12} />
                  Edit
                </button>
              )}
            </div>
          )}

          {!effectiveSnapshot && suggestedTitle && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                AI suggested title
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-slate-800 flex-1 min-w-0">{suggestedTitle}</p>
                <button
                  type="button"
                  disabled={
                    applyBusy ||
                    titleBusy ||
                    suggestionMatchesTitle ||
                    editingTitle ||
                    scoringInFlight
                  }
                  onClick={() => void handleApplySuggestedTitle()}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
                >
                  {applyBusy ? "Applying…" : suggestionMatchesTitle ? "Applied" : "Apply"}
                </button>
              </div>
            </div>
          )}
        </div>

        {!effectiveSnapshot && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-6">
            <p className="text-md font-semibold uppercase tracking-wide text-slate-600 mb-3">
              Article type
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={selectedTypeId || undefined}
                onValueChange={setSelectedTypeId}
                disabled={typeBusy || reevalBusy || scoringInFlight}
              >
                <SelectTrigger className="min-w-[240px] bg-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {articleTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                disabled={!typeChanged || typeBusy || reevalBusy || scoringInFlight}
                onClick={() => handleChangeType(true)}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {typeBusy ? "Saving…" : "Change type & re-evaluate"}
              </button>
              <button
                type="button"
                disabled={!typeChanged || typeBusy || reevalBusy || scoringInFlight}
                onClick={() => handleChangeType(false)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                Change type only
              </button>
              <button
                type="button"
                disabled={typeBusy || reevalBusy || scoringInFlight || !!typeChanged}
                onClick={handleReevaluate}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-40"
              >
                {reevalBusy ? "Starting…" : scoringInFlight ? "Scoring…" : "Re-evaluate"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Changing type snapshots the prior score (if any). Not suitable skips AI scoring.
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-md font-semibold uppercase tracking-wide text-slate-600 mb-1">
              Current Score
            </p>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                {isFailed ? (
                  <div className="py-2">
                    <p className="font-medium text-red-600">Evaluation failed</p>
                    {displayFeedback ? (
                      <p className="text-sm text-slate-600 mt-1 break-words">{displayFeedback}</p>
                    ) : (
                      <p className="text-sm text-slate-500 mt-1">
                        Use Re-evaluate above, or ask the user to re-submit.
                      </p>
                    )}
                  </div>
                ) : isScoring ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-1">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                    <span>Scoring…</span>
                  </div>
                ) : isPendingUnscored ? (
                  <p className="text-sm text-slate-500 py-1">
                    Not scored yet — use Re-evaluate to run scoring.
                  </p>
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

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-md font-semibold uppercase tracking-wide text-slate-600">
                Feedback
              </p>

              {displayFeedback && <CopyButton text={displayFeedback} />}
            </div>

            {isFailed ? (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  Evaluation failed. Re-evaluate or ask the user to re-submit.
                </p>
                {displayFeedback && (
                  <p className="text-sm text-slate-600 break-words rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    {displayFeedback}
                  </p>
                )}
              </div>
            ) : isScoring ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 size={16} className="animate-spin text-slate-400" />
                <span>Scoring…</span>
              </div>
            ) : isPendingUnscored ? (
              <p className="text-sm text-slate-500">No feedback yet.</p>
            ) : (
              <FeedbackBlock feedback={displayFeedback || "No feedback available yet."} />
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
                    <ArticleCopyButton title={`# ${displayTitle}`} text={displayContent} />
                    <DownloadMarkdownButton
                      title={displayTitle}
                      content={displayContent}
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
                <ArticleViewer content={displayContent} />
              </div>
            )}
          </div>

          {!effectiveSnapshot && <ScoringHistoryTable history={history} articleId={article.id} />}
        </div>
      </div>
    </div>
  );
}
