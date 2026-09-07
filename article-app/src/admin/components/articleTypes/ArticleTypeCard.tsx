import {
  ChevronDown,
  Clock,
  FileText,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";
import { formatDateToUSLocale } from "../../utils/date";
import Badge from "../ui/Badge";
import { ArticleTypeWithPrompt, ParameterOptionDraft } from "@/admin/utils/types";

type ArticleTypeCardProps = {
  type: ArticleTypeWithPrompt;
  isExpanded: boolean;
  onToggle: (type: string | null) => void;
  onEdit: (type: ArticleTypeWithPrompt) => void;
  onDelete: (type: ArticleTypeWithPrompt) => void;
};

const AVATAR_PALETTE = [
  "bg-indigo-50 text-indigo-600",
  "bg-violet-50 text-violet-600",
  "bg-sky-50 text-sky-600",
  "bg-teal-50 text-teal-600",
  "bg-rose-50 text-rose-600",
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

function ArticleTypeCard({
  type,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: ArticleTypeCardProps) {
  return (
    <div className="group">
      <button
        onClick={() => onToggle(isExpanded ? null : type.id)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-slate-200 hover:brightness-95 transition-colors"
      >
        <div
          className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center font-semibold text-sm ${getAvatarColor(type.name)}`}
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
            <p className="text-sm text-slate-500 truncate mt-0.5">
              {type.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <ActionButton
            icon={<Pencil size={15} />}
            label={`Edit ${type.name}`}
            onClick={() => onEdit(type)}
            hoverClass="hover:bg-slate-100 hover:text-indigo-600"
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
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded prompt view */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
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
                <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed bg-white border border-slate-200 rounded-lg p-3 max-h-85 overflow-y-auto shadow-sm">
                  {type.score_prompt}
                </pre>
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
                  {(type.parameters as unknown as { id: string; name: string; prompt?: string | null; scopeType: string; options?: ParameterOptionDraft[] | null; minValue?: string | number | null; maxValue?: string | number | null }[]).map((param) => (
                    <div
                      key={param.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-slate-900">
                            {param.name}
                          </h4>

                          <p className="mt-1 text-sm text-slate-500">
                            {param.prompt}
                          </p>
                        </div>

                        <Badge variant="indigo">
                          {param.scopeType.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex gap-1 my-1">
                        {param.options?.map((option: ParameterOptionDraft) => (
                          <Badge key={option.id} variant="indigo">
                            {option.label}
                          </Badge>
                        ))}
                      </div>

                      {(param.options?.length ?? 0) === 0 && (
                        <Badge variant="indigo">
                          {param.minValue} - {param.maxValue}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">
                  No parameters configured.
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
