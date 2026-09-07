import { ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

export default function ParameterResultsBox({
  results,
}: {
  results: { parameter_name: string; name?: string; value: string | number | null }[];
}) {
  const [open, setOpen] = useState(false);
  if (!results || !results.length)
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
            <p className="text-sm text-slate-400">No parameter results yet</p>
          </div>
        )}
      </div>
    );
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
        <div className="px-4 pb-4 grid gap-2">
          {results.map((r: { parameter_name: string; name?: string; value: string | number | null }, i: number) => (
            <div
              key={i}
              className="flex justify-between items-center bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
            >
              <span className="text-sm font-medium text-slate-700">
                {r.parameter_name || r.name}
              </span>
              <span className="text-sm font-semibold text-slate-900 bg-white border border-slate-200 rounded-full px-2.5 py-0.5">
                {r.value == null ? "—" : String(r.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
