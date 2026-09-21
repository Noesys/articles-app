import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/http-client";

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
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SuggestionsPanel({
  articleId,
  version,
  onContentUpdated,
}: {
  articleId: string;
  version: number;
  onContentUpdated?: (content: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyAllBusy, setApplyAllBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [editedCount, setEditedCount] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api(`/admin/articles/${articleId}/suggestions?version=${version}`);
      setSuggestions(res?.data?.suggestions ?? res?.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [articleId, version]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyIds(ids: string[], all = false) {
    if (all) setApplyAllBusy(true);
    else setBusyId(ids[0] ?? null);
    try {
      const res: any = await api(`/admin/articles/${articleId}/suggestions/apply`, {
        method: "POST",
        body: JSON.stringify({ suggestionIds: ids }),
      });
      const applied: string[] = res?.data?.applied ?? [];
      const failed: { id: string; reason: string }[] = res?.data?.failed ?? [];
      const nextErrors: Record<string, string> = {};
      for (const f of failed) nextErrors[f.id] = f.reason;
      setErrors(nextErrors);
      if (applied.length > 0) {
        setSuggestions((prev) =>
          prev.map((s) => (applied.includes(s.id) ? { ...s, applied: 1 } : s)),
        );
        setEditedCount((n) => n + applied.length);
        if (res?.data?.content) onContentUpdated?.(res.data.content);
        toast.success(applied.length === 1 ? "Suggestion applied" : `${applied.length} suggestions applied`);
      }
      for (const f of failed) toast.error(f.reason);
      if (applied.length === 0 && failed.length === 0) toast.message("Nothing to apply");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
      setApplyAllBusy(false);
    }
  }

  const pending = suggestions.filter((s) => !s.applied);
  const visible = pending.slice(0, 8);
  const hiddenCount = Math.max(0, pending.length - visible.length);

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
          AI Suggestions{pending.length > 0 ? ` (${pending.length})` : ""}
        </p>
        <span className="p-1 text-slate-400">
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </div>
      {!collapsed && (
        <div className="px-4 pb-4">
          {editedCount > 0 && (
            <div className="mb-3 rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Content edited since last evaluation ({editedCount} applied). Scores and feedback
              below are from before these edits — re-evaluate for fresh results.
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
              <Loader2 size={16} className="animate-spin text-slate-400" />
              <span>Loading suggestions…</span>
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-slate-500 py-1">No suggestions for this version yet.</p>
          ) : (
            <>
              {pending.length > 1 && (
                <button
                  type="button"
                  disabled={applyAllBusy}
                  onClick={() => void applyIds(pending.map((s) => s.id), true)}
                  className="mb-3 rounded-sm bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {applyAllBusy ? "Applying…" : `Apply all (${pending.length})`}
                </button>
              )}
              <div className="space-y-3">
                {visible.map((s) => (
                  <div key={s.id} className="rounded-sm border border-slate-200 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-900 flex-1 min-w-0">{s.title}</p>
                      {s.parameter_name && (
                        <span className="text-xs px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                          {s.parameter_name}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">block {s.target_block_index}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{s.reason}</p>
                    <div className="mt-2 grid gap-1.5 text-xs font-mono">
                      <div className="rounded-sm bg-red-50 border border-red-100 px-2 py-1.5 text-red-800 break-words">
                        <span className="font-sans font-semibold">− </span>
                        {stripHtml(s.old_text).slice(0, 600)}
                      </div>
                      <div className="rounded-sm bg-green-50 border border-green-100 px-2 py-1.5 text-green-800 break-words">
                        <span className="font-sans font-semibold">+ </span>
                        {stripHtml(s.new_text).slice(0, 600)}
                      </div>
                    </div>
                    {errors[s.id] && (
                      <p className="mt-1.5 text-xs text-red-600">{errors[s.id]}</p>
                    )}
                    <button
                      type="button"
                      disabled={busyId === s.id || applyAllBusy}
                      onClick={() => void applyIds([s.id])}
                      className="mt-2 inline-flex items-center gap-1 rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-slate-700 disabled:opacity-40"
                    >
                      {busyId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      {busyId === s.id ? "Applying…" : "Apply"}
                    </button>
                  </div>
                ))}
              </div>
              {hiddenCount > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  + {hiddenCount} more pending — use Apply all to apply them.
                </p>
              )}
              {suggestions.some((s) => s.applied) && (
                <p className="mt-2 text-xs text-slate-400">
                  {suggestions.filter((s) => s.applied).length} applied.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
