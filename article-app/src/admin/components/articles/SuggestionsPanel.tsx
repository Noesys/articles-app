import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/http-client";
import { decodeEntities, wordDiff } from "@/utils/wordDiff";

export interface Suggestion {
  id: string;
  article_id: string;
  version: number;
  title: string;
  reason: string;
  parameter_name: string | null;
  target_block_index: number;
  old_text: string;
  new_text: string;
  applied: number;
  stale?: boolean;
}

function DiffCell({ oldText, newText, dimmed }: { oldText: string; newText: string; dimmed: boolean }) {
  const parts = useMemo(() => wordDiff(oldText, decodeEntities(newText)), [oldText, newText]);
  return (
    <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${dimmed ? "opacity-60" : ""}`}>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          <del key={i} className="bg-red-50 text-red-700 decoration-red-400">
            {p.text}
          </del>
        ) : (
          <ins key={i} className="bg-green-100 text-green-800 no-underline">
            {p.text}
          </ins>
        ),
      )}
    </p>
  );
}

export default function SuggestionsPanel({
  articleId,
  version,
  scored,
  onContentUpdated,
}: {
  articleId: string;
  version: number;
  /** Suggestions only exist once the article has been scored. */
  scored: boolean;
  onContentUpdated?: (content: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyAllBusy, setApplyAllBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fetchList = useCallback(async (): Promise<Suggestion[]> => {
    try {
      const res: any = await api(`/admin/articles/${articleId}/suggestions?version=${version}`);
      return res?.data?.suggestions ?? res?.suggestions ?? [];
    } catch {
      return [];
    }
  }, [articleId, version]);

  // Opening an article only READS suggestions an admin already generated (a
  // plain DB read). The AI runs only when "Generate suggestions" is clicked.
  useEffect(() => {
    setSuggestions([]);
    setErrors({});

    if (!scored) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      const list = await fetchList();
      if (cancelled) return;
      setSuggestions(list);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scored, fetchList]);

  async function generate() {
    setGenerating(true);
    try {
      const res: any = await api(`/admin/articles/${articleId}/suggestions/generate`, {
        method: "POST",
      });
      const list: Suggestion[] = res?.data?.suggestions ?? res?.suggestions ?? [];
      setSuggestions(list);
      if (list.length === 0) toast.message(res?.message || "No suggestions this time");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function applyIds(ids: string[], all = false) {
    if (all) setApplyAllBusy(true);
    else setBusyId(ids[0] ?? null);
    try {
      const res: any = await api(`/admin/articles/${articleId}/suggestions/apply`, {
        method: "POST",
        body: JSON.stringify({ suggestionIds: ids }),
      });
      const data = res?.data ?? res;
      const applied: string[] = data?.applied ?? [];
      const failed: { id: string; reason: string }[] = data?.failed ?? [];

      const nextErrors: Record<string, string> = {};
      for (const f of failed) nextErrors[f.id] = f.reason;
      setErrors(nextErrors);

      if (applied.length > 0) {
        if (data?.content) onContentUpdated?.(data.content);
        // Other rows' target text may have moved; re-read so stale flags are right.
        setSuggestions(await fetchList());
        toast.success(applied.length === 1 ? "Suggestion applied" : `${applied.length} suggestions applied`);
      }
      if (applied.length === 0 && failed.length === 0) toast.message("Nothing to apply");
      else if (applied.length === 0) toast.error(failed[0].reason);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
      setApplyAllBusy(false);
    }
  }

  const pending = suggestions.filter((s) => !s.applied && !s.stale);
  const appliedCount = suggestions.filter((s) => s.applied).length;

  return (
    <div className="rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed(!collapsed)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed(!collapsed);
          }
        }}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      >
        <p className="text-md font-semibold uppercase tracking-wide text-slate-600">
          Suggested changes{pending.length > 0 ? ` (${pending.length})` : ""}
        </p>
        <div className="flex items-center gap-2">
          {pending.length > 1 && (
            <span onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={applyAllBusy || busyId !== null}
                onClick={() => void applyIds(pending.map((s) => s.id), true)}
                className="rounded-sm bg-teal-600 hover:bg-teal-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
              >
                {applyAllBusy ? "Applying…" : "Apply all"}
              </button>
            </span>
          )}
          <span className="p-1 text-slate-400">
            {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </span>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4">
          {appliedCount > 0 && (
            <div className="mb-3 rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              {appliedCount} {appliedCount === 1 ? "change" : "changes"} applied to the article. The
              score and feedback above are from before these edits — re-evaluate for fresh results.
            </div>
          )}

          {!scored ? (
            <p className="text-sm text-slate-500 py-1">
              Suggestions appear once the article has been scored.
            </p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Loader2 size={16} className="animate-spin text-slate-400" />
              <span>Loading suggestions…</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3 py-1">
              {generating ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                  <span>Generating suggestions… this can take up to a minute.</span>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No suggestions yet. Generate them when you want AI edits for this version.
                </p>
              )}
              <button
                type="button"
                disabled={generating}
                onClick={() => void generate()}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
              >
                <Sparkles size={12} />
                {generating ? "Generating…" : "Generate suggestions"}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-sm border border-slate-200">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[26%] px-3 py-2">Suggestion</th>
                    <th className="px-3 py-2">Change</th>
                    <th className="w-[110px] px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {suggestions.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-slate-900">{s.title}</p>
                        {s.parameter_name && (
                          <span className="mt-1 inline-block rounded-sm bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {s.parameter_name}
                          </span>
                        )}
                        <p className="mt-1.5 text-xs text-slate-500">{s.reason}</p>
                      </td>
                      <td className="px-3 py-3">
                        <DiffCell oldText={s.old_text} newText={s.new_text} dimmed={!!s.applied || !!s.stale} />
                        {errors[s.id] && <p className="mt-1.5 text-xs text-red-600">{errors[s.id]}</p>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {s.applied ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-green-50 border border-green-200 px-2 py-1 text-xs font-medium text-green-700">
                            <Check size={12} /> Applied
                          </span>
                        ) : s.stale ? (
                          <span
                            title="The text this targeted has since changed"
                            className="inline-block rounded-sm bg-amber-50 border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700"
                          >
                            Outdated
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busyId === s.id || applyAllBusy}
                            onClick={() => void applyIds([s.id])}
                            className="inline-flex items-center gap-1 rounded-sm bg-teal-600 hover:bg-teal-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
                          >
                            {busyId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                            {busyId === s.id ? "Applying…" : "Apply"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
