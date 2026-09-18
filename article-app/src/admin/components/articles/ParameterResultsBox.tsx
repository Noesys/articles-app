import { ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import MarkdownContent from "@/components/markdown/MarkdownContent";
import { cn } from "@/lib/utils";

type Row = {
  parameter_name: string;
  name?: string;
  parameter_description?: string | null;
  description?: string | null;
  scope_type?: string;
  scopeType?: string;
  max_value?: number | null;
  maxValue?: number | null;
  value: string | number | null;
  feedback?: string | null;
};

function getScoreDisplay(r: Row): string {
  const max = r.max_value ?? r.maxValue;
  const scope = r.scope_type ?? r.scopeType;
  const isNumeric =
    scope === "numeric" && typeof r.value === "number" && max != null;
  if (isNumeric) return `${r.value}/${max}`;
  if (r.value == null) return "—";
  return String(r.value);
}

export default function ParameterResultsBox({ results }: { results: Row[] }) {
  const [open, setOpen] = useState(false);
  // Per-parameter collapse state, default everything open.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <p className="text-md font-semibold uppercase tracking-wide text-slate-600">
          Parameter Results
        </p>
        {open ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4">
          {!results || !results.length ? (
            <p className="text-sm text-slate-400">No parameter results yet</p>
          ) : (
            <div className="divide-y divide-slate-200 rounded-sm border border-slate-200 overflow-hidden">
              {results.map((r, i) => {
                const id = String(i);
                const isCollapsed = collapsed[id] ?? false;
                const name = r.parameter_name || r.name;
                const desc = r.parameter_description ?? r.description ?? null;
                return (
                  <div key={id} className="bg-white">
                    <button
                      onClick={() => toggleRow(id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                      aria-expanded={!isCollapsed}
                    >
                      <span className="text-slate-400 shrink-0">
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-slate-800">
                          {name}
                        </span>
                        {desc ? (
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">
                            {desc}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-block shrink-0 font-semibold text-slate-900 bg-white border border-slate-200 rounded-sm px-2.5 py-0.5">
                        {getScoreDisplay(r)}
                      </span>
                    </button>
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                        isCollapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pl-11">
                          {r.feedback ? (
                            <MarkdownContent className="[&_p]:mb-1.5 [&_ul]:mb-1.5">
                              {r.feedback}
                            </MarkdownContent>
                          ) : (
                            <span className="text-slate-300 italic text-sm">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
