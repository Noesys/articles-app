import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, FileText, Info, Pencil, Tag, Trash2 } from "lucide-react";
import { formatDateToUSLocale } from "../../utils/date";
import Badge from "../ui/Badge";
import { ArticleTypeWithPrompt, ParameterOptionDraft } from "@/admin/utils/types";
import MarkdownContent from "@/components/markdown/MarkdownContent";

type ArticleTypeCardProps = {
  type: ArticleTypeWithPrompt;
  isExpanded: boolean;
  onToggle: (type: string | null) => void;
  onEdit: (type: ArticleTypeWithPrompt) => void;
  onDelete: (type: ArticleTypeWithPrompt) => void;
};

const AVATAR_PALETTE = [
  "bg-indigo-50 text-indigo-600",
  "bg-sky-50 text-sky-600",
  "bg-teal-50 text-teal-600",
  "bg-cyan-50 text-cyan-600",
  "bg-emerald-50 text-emerald-600",
];

function getAvatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function ActionButton({
  icon,
  label,
  onClick,
  hoverClass,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  hoverClass: string;
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`p-2 rounded-md text-slate-400 transition-colors ${hoverClass}`}
      aria-label={label}
    >
      {icon}
    </span>
  );
}

const INSTRUCTIONS_CLAMP_LINES = 4;

function ArticleTypeCard({ type, isExpanded, onToggle, onEdit, onDelete }: ArticleTypeCardProps) {
  const [instructionsShowFull, setInstructionsShowFull] = useState(false);
  const [instructionsOverflows, setInstructionsOverflows] = useState(false);
  const instructionsClampRef = useRef<HTMLDivElement>(null);

  // Only measurable while clamped (full text has no overflow to detect) and
  // while the card is actually laid out (the collapsed-card grid trick keeps
  // this mounted but at 0 height, which would always read as "no overflow").
  useEffect(() => {
    if (!isExpanded || instructionsShowFull) return;
    const el = instructionsClampRef.current;
    if (!el) return;
    setInstructionsOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [isExpanded, instructionsShowFull, type.general_instructions]);

  return (
    <div className="group">
      <button
        onClick={() => onToggle(isExpanded ? null : type.id)}
        className="flex w-full items-center gap-3 bg-slate-100 px-4 py-3.5 text-left transition-[background-color] duration-[var(--duration-fast)] hover:bg-slate-200/80"
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-sm font-semibold ${getAvatarColor(type.name)}`}
        >
          {type.name.charAt(0).toUpperCase() || <Tag size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">{type.name}</span>
            {type.pass_threshold !== undefined && type.pass_threshold !== null && (
              <Badge variant="indigo">Pass: {type.pass_threshold}</Badge>
            )}
            {!type.is_active && (
              <Badge variant="danger" dot>
                Inactive
              </Badge>
            )}
            {!type.score_prompt && (
              <Badge variant="warning" dot>
                No prompt set
              </Badge>
            )}
          </div>
          {type.description && (
            <p className="text-sm text-slate-500 truncate mt-0.5">{type.description}</p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 ">
          <ActionButton
            icon={<Pencil size={15} />}
            label={`Edit ${type.name}`}
            onClick={() => onEdit(type)}
            hoverClass="hover:bg-slate-100 hover:text-teal-600"
          />
          <ActionButton
            icon={<Trash2 size={15} />}
            label={`Delete ${type.name}`}
            onClick={() => onDelete(type)}
            hoverClass="hover:bg-red-50 hover:text-red-600"
          />
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-[var(--duration-med)] ease-[var(--ease-out-contiq)] motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded prompt view — height transition; reduced-motion = instant via global CSS */}
      <div
        className={`grid transition-[grid-template-rows] duration-[var(--duration-med)] ease-[var(--ease-out-contiq)] motion-reduce:transition-none ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 px-4 py-3.5 bg-slate-50/70 space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Clock size={12} />
              Updated {formatDateToUSLocale(type.updated_at)}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                <FileText size={15} />
                Scoring Prompt
              </div>
              {type.score_prompt ? (
                <MarkdownContent className="max-h-85 overflow-y-auto rounded-sm border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)]">
                  {type.score_prompt}
                </MarkdownContent>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No prompt has been configured for this type yet.
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                <Tag size={13} />
                Parameters
              </div>

              {type.parameters.length > 0 ? (
                <div className="space-y-3">
                  {(
                    type.parameters as unknown as {
                      id: string;
                      name: string;
                      description?: string | null;
                      prompt?: string | null;
                      scopeType: string;
                      options?: ParameterOptionDraft[] | null;
                      minValue?: string | number | null;
                      maxValue?: string | number | null;
                    }[]
                  ).map((param) => (
                    <div key={param.id} className="rounded-sm border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h4 className="font-medium text-slate-900">{param.name}</h4>

                        <Badge variant="indigo">
                          {param.scopeType.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="overflow-hidden rounded-md border border-slate-200">
                        <table className="w-full text-sm">
                          <tbody>
                            <tr className="border-b border-slate-200">
                              <td className="w-40 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                                Description
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {param.description || "-"}
                              </td>
                            </tr>

                            <tr className="border-b border-slate-200">
                              <td className="bg-slate-50 px-3 py-2 font-medium text-slate-700">
                                Scoring Prompt
                              </td>
                              <td className="px-3 py-2">
                                {param.prompt ? (
                                  <MarkdownContent>{param.prompt}</MarkdownContent>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>

                            <tr>
                              <td className="bg-slate-50 px-3 py-2 font-medium text-slate-700">
                                Options
                              </td>
                              <td className="px-3 py-2">
                                {(param.options?.length ?? 0) > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {param.options?.map((option: ParameterOptionDraft) => (
                                      <Badge key={option.id} variant="indigo">
                                        {option.label}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <Badge variant="indigo">
                                    {param.minValue} - {param.maxValue}
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No parameters configured.</p>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
                <Info size={13} />
                General Instructions
              </div>
              {type.general_instructions ? (
                <div>
                  <div
                    ref={instructionsClampRef}
                    style={
                      instructionsShowFull
                        ? undefined
                        : {
                            display: "-webkit-box",
                            WebkitLineClamp: INSTRUCTIONS_CLAMP_LINES,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }
                    }
                  >
                    <MarkdownContent className="rounded-sm border border-slate-200 bg-white p-3 shadow-[var(--shadow-card)]">
                      {type.general_instructions}
                    </MarkdownContent>
                  </div>
                  {instructionsOverflows && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInstructionsShowFull((v) => !v);
                      }}
                      className="mt-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                    >
                      {instructionsShowFull ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No general instructions configured for this type.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ArticleTypeCard;
