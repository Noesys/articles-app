import { useEffect, useMemo, useRef, useState, WheelEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown/markdownComponents";
import Button from "../../components/ui/Button";
import DeleteConfirmation from "./DeleteConfirmation";
import { api, apiFull } from "@/http-client";
import Badge from "../../components/ui/Badge";
import {
  ArticleTypeResponse,
  FormState,
  ParameterDraft,
  ParameterResponse,
  ParameterSearchResult,
} from "@/admin/utils/types";
import ArticleTypesParameterModal from "./ArticleTypesParameterModal";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { ColumnDef, useTable } from "@tanstack/react-table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader, PageShell } from "@/components/page-chrome";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Button as ShadcnButton } from "@/components/ui/button";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  generalInstructions: "",
  promptContent: "",
  scoreMin: "0",
  scoreMax: "10",
  passThreshold: "10",
  minWords: "1000",
  parameters: [],
};

const EMPTY_PARAM_DRAFT: Omit<ParameterDraft, "id" | "isNew"> = {
  name: "",
  description: "",
  prompt: "",
  scopeType: "numeric",
  minValue: "0",
  maxValue: "10",
  options: [],
};

function parameterFromResponse(p: ParameterResponse): ParameterDraft {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    prompt: p.prompt,
    scopeType: p.scope_type,
    minValue: p.min_value?.toString() ?? "0",
    maxValue: p.max_value?.toString() ?? "10",
    options: p.options ?? [],
    isNew: false,
  };
}
function parameterToBody(p: ParameterDraft) {
  if (p.scopeType === "numeric")
    return {
      name: p.name.trim(),
      description: p.description?.trim() || null,
      prompt: p.prompt.trim(),
      scopeType: "numeric",
      minValue: Number(p.minValue),
      maxValue: Number(p.maxValue),
    };
  return {
    name: p.name.trim(),
    description: p.description?.trim() || null,
    prompt: p.prompt.trim(),
    scopeType: "option",
    options: p.options,
  };
}

export default function ArticleTypesForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const handleWheel = (e: WheelEvent<HTMLInputElement>) => {
    // Blur the element to prevent changing the number value on scroll
    e.currentTarget.blur();
  };

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [removedParameterIds, setRemovedParameterIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState<ParameterDraft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ParameterDraft | null>(
    null,
  );
  const [instructionsPreviewOpen, setInstructionsPreviewOpen] = useState(false);

  // "Copy from existing parameter" search — independent of isEditing, since
  // it should work while creating a brand-new type too.
  const [allParameters, setAllParameters] = useState<ParameterSearchResult[]>([]);
  const [paramSearchQuery, setParamSearchQuery] = useState("");
  const [paramSearchOpen, setParamSearchOpen] = useState(false);
  const paramSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<ParameterSearchResult[]>("/admin/article-types/parameters/all")
      .then(setAllParameters)
      .catch((err) => console.error("Failed to load parameters for search:", err));
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (paramSearchRef.current && !paramSearchRef.current.contains(e.target as Node)) {
        setParamSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const paramSearchResults = useMemo(() => {
    const q = paramSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return allParameters
      .filter((p) => p.article_type_id !== id)
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.options.some((o) => o.label.toLowerCase().includes(q)),
      )
      .slice(0, 20);
  }, [allParameters, paramSearchQuery, id]);

  const handleCopyParameter = (p: ParameterSearchResult) => {
    setModalDraft({
      id: crypto.randomUUID(),
      name: p.name,
      description: p.description ?? "",
      prompt: p.prompt,
      scopeType: p.scope_type,
      minValue: p.min_value?.toString() ?? "0",
      maxValue: p.max_value?.toString() ?? "10",
      // No id carried over — these must be treated as brand-new options
      // under the new parameter, never referencing the source's option
      // rows (which belong to a different parameter_id entirely).
      options: p.options.map((o) => ({ label: o.label })),
      isNew: true,
    });
    setModalOpen(true);
    setParamSearchQuery("");
    setParamSearchOpen(false);
  };

  useEffect(() => {
    if (!id) return;
    async function loadArticleType() {
      setLoading(true);
      try {
        const [t, params] = await Promise.all([
          api<ArticleTypeResponse>(`/admin/article-types/${id}`),
          api<ParameterResponse[]>(`/admin/article-types/${id}/parameters`),
        ]);
        setForm({
          name: t.name,
          description: t.description ?? "",
          generalInstructions: (t as any).general_instructions ?? "",
          promptContent: t.score_prompt,
          scoreMin: t.score_min.toString(),
          scoreMax: t.score_max.toString(),
          passThreshold: t.pass_threshold.toString(),
          minWords: (t.min_words ?? 1000).toString(),
          parameters: params.map(parameterFromResponse),
        });
      } catch (err) {
        console.error(err);
        setError(
          "Couldn't load this article type. Try going back and re-opening it.",
        );
      } finally {
        setLoading(false);
      }
    }
    loadArticleType();
  }, [id]);

  const openAddModal = () => {
    setModalDraft({
      id: crypto.randomUUID(),
      ...EMPTY_PARAM_DRAFT,
      isNew: true,
    });
    setModalOpen(true);
  };
  const openEditModal = (p: ParameterDraft) => {
    setModalDraft({ ...p, options: [...p.options] });
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalDraft(null);
  };

  const saveModal = () => {
    if (!modalDraft) return;
    if (!modalDraft.name.trim() || !modalDraft.prompt.trim()) return;
    if (
      modalDraft.scopeType === "numeric" &&
      Number(modalDraft.maxValue) <= Number(modalDraft.minValue)
    )
      return;
    if (
      modalDraft.scopeType === "option" &&
      modalDraft.options.filter((o) => o.label.trim()).length === 0
    ) {
      toast.error("Add at least one option before saving.");
      return;
    }
    const exists = form.parameters.some((p) => p.id === modalDraft.id);
    if (exists)
      setForm((c) => ({
        ...c,
        parameters: c.parameters.map((p) =>
          p.id === modalDraft.id ? modalDraft : p,
        ),
      }));
    else setForm((c) => ({ ...c, parameters: [...c.parameters, modalDraft] }));
    closeModal();
  };

  const confirmRemoveParameter = () => {
    if (!pendingDelete) return;
    const parameterId = pendingDelete.id;
    const parameter = form.parameters.find((p) => p.id === parameterId);
    if (parameter && !parameter.isNew)
      setRemovedParameterIds((current) => [...current, parameterId]);
    setForm((current) => ({
      ...current,
      parameters: current.parameters.filter((p) => p.id !== parameterId),
    }));
    setPendingDelete(null);
  };

  const scoreMinNum = Number(form.scoreMin);
  const scoreMaxNum = Number(form.scoreMax);
  const passThresholdNum = Number(form.passThreshold);
  const minWordsNum = Number(form.minWords);
  const scoreRangeInvalid =
    form.scoreMin !== "" && form.scoreMax !== "" && scoreMaxNum <= scoreMinNum;
  const thresholdInvalid =
    !scoreRangeInvalid &&
    form.passThreshold !== "" &&
    (passThresholdNum < scoreMinNum || passThresholdNum > scoreMaxNum);
  const minWordsInvalid =
    form.minWords.trim() === "" ||
    !Number.isInteger(minWordsNum) ||
    minWordsNum < 1;
  const canSubmit =
    form.name.trim() &&
    form.promptContent.trim() &&
    !scoreRangeInvalid &&
    !thresholdInvalid &&
    !minWordsInvalid &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const invalidParameter = form.parameters.find(
      (p) => !p.name.trim() || !p.prompt.trim(),
    );
    if (invalidParameter) {
      openEditModal(invalidParameter);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim(),
        general_instructions: form.generalInstructions.trim() || null,
        scorePrompt: form.promptContent.trim(),
        scoreMin: scoreMinNum,
        scoreMax: scoreMaxNum,
        passThreshold: passThresholdNum,
        minWords: minWordsNum,
      });
      let articleTypeId = id;
      if (isEditing) {
        await api(`/admin/article-types/${id}`, { method: "PATCH", body });
      } else {
        const created: any = await apiFull(`/admin/article-types`, {
          method: "POST",
          body,
        });
        articleTypeId = created.data.id;
      }
      await Promise.all(
        removedParameterIds.map((paramId) =>
          api(`/admin/article-types/${articleTypeId}/parameters/${paramId}`, {
            method: "DELETE",
          }),
        ),
      );
      await Promise.all(
        form.parameters.map((p) => {
          const paramBody = JSON.stringify(parameterToBody(p));
          if (p.isNew)
            return api(`/admin/article-types/${articleTypeId}/parameters`, {
              method: "POST",
              body: paramBody,
            });
          return api(
            `/admin/article-types/${articleTypeId}/parameters/${p.id}`,
            {
              method: "PATCH",
              body: paramBody,
            },
          );
        }),
      );
      navigate("/admin/article-types");
    } catch (err) {
      console.error(err);
      setError(
        "Something went wrong saving this article type. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return <div className="m-5 text-sm text-slate-400">Loading…</div>;

  return (
    <PageShell>
      <button
        onClick={() => navigate("/admin/article-types")}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft size={14} /> Back to article types
      </button>

      <PageHeader
        title={isEditing ? "Edit article type" : "New article type"}
      />

      {error && <InlineAlert>{error}</InlineAlert>}

      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. Marketing, Software, HR"
            className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
          />
        </div>

        {/* Description on the left (tall) + stacked Pass Threshold / Min Word Count on the right */}
        <div className="grid grid-cols-10 gap-4">
          <div className="col-span-7 flex flex-col">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((c) => ({ ...c, description: e.target.value }))
              }
              placeholder="Short description (optional)"
              rows={4}
              className="w-full resize-y rounded-sm border border-border bg-white px-3 py-4 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
            />
          </div>

          <div className="col-span-3 flex flex-col gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Pass Threshold{" "}
                <span className="font-normal text-slate-400">(Accepts 0-10 only)</span>
              </label>
              <input
                type="number"
                value={form.passThreshold}
                min={0}
                max={10}
                onWheel={handleWheel}
                onChange={(e) => {
                  const value = Number(e.target.value);

                  if (value > 10) return;
                  if (value < 0 && e.target.value !== "") return;

                  setForm((c) => ({
                    ...c,
                    passThreshold: e.target.value,
                  }));
                }}
                placeholder="10"
                className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Minimum Word Count
              </label>
              <input
                type="number"
                value={form.minWords}
                min={1}
                step={1}
                onWheel={handleWheel}
                onChange={(e) => {
                  if (e.target.value !== "" && Number(e.target.value) < 1) return;
                  setForm((c) => ({ ...c, minWords: e.target.value }));
                }}
                placeholder="1000"
                className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
              />
              {minWordsInvalid && (
                <p className="mt-1 text-xs text-red-600">
                  Enter a positive whole number.
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Scoring Prompt
          </label>
          <textarea
            value={form.promptContent}
            onChange={(e) =>
              setForm((c) => ({ ...c, promptContent: e.target.value }))
            }
            placeholder="The full AI scoring prompt for this article type..."
            rows={8}
            className="w-full resize-y rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Parameters
            </label>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={13} />}
              type="button"
              onClick={openAddModal}
            >
              Add Parameter
            </Button>
          </div>

          <div ref={paramSearchRef} className="relative mb-3">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={paramSearchQuery}
                onChange={(e) => {
                  setParamSearchQuery(e.target.value);
                  setParamSearchOpen(true);
                }}
                onFocus={() => setParamSearchOpen(true)}
                placeholder="Search existing parameters to reuse (e.g. Authenticity)..."
                className="w-full rounded-sm border border-border bg-white py-2 pr-3 pl-8 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
            {paramSearchOpen && paramSearchQuery.trim() && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-sm border border-slate-200 bg-white shadow-lg">
                {paramSearchResults.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-slate-400">
                    No matching parameters found.
                  </p>
                ) : (
                  paramSearchResults.map((p) => (
                    <button
                      key={`${p.article_type_id}:${p.id}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCopyParameter(p);
                      }}
                      className="flex w-full flex-col items-start gap-0.5 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-800">
                        {p.name}{" "}
                        <span className="font-normal text-slate-400">
                          - {p.article_type_name}
                        </span>
                      </span>
                      <span className="line-clamp-1 text-xs text-slate-500">
                        {p.prompt}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <ParametersTable
            parameters={form.parameters}
            onEdit={openEditModal}
            onDelete={setPendingDelete}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              General Instructions{" "}
              <span className="font-normal text-slate-400">
                (Shown on article type select)
              </span>
            </label>
            <span className="text-xs text-slate-400"></span>
          </div>
          <textarea
            value={form.generalInstructions}
            onChange={(e) =>
              setForm((c) => ({ ...c, generalInstructions: e.target.value }))
            }
            placeholder="General guidelines for the article"
            rows={5}
            className="w-full resize-y rounded-sm border border-border bg-white px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
          />
          {form.generalInstructions.trim() ? (
            <div className="mt-2 rounded-sm border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setInstructionsPreviewOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50"
              >
                <span className="text-sm font-medium text-slate-600">
                  General instructions preview
                </span>
                <span className="text-slate-400 p-1">{instructionsPreviewOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </button>
              {instructionsPreviewOpen && (
                <div className="prose prose-sm max-w-none px-3 py-2">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {form.generalInstructions}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button
            variant="secondary"
            onClick={() => navigate("/admin/article-types")}
            disabled={submitting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
            type="button"
          >
            {isEditing ? "Save Changes" : "Create Type"}
          </Button>
        </div>
      </div>

      <DeleteConfirmation
        open={!!pendingDelete}
        name={pendingDelete?.name || "this parameter"}
        submitting={false}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmRemoveParameter}
        variant="parameter"
      />

      <ArticleTypesParameterModal
        modalOpen={modalOpen}
        modalDraft={modalDraft}
        setModalDraft={setModalDraft}
        saveModal={saveModal}
        closeModal={closeModal}
      />
    </PageShell>
  );
}

function ParametersTable({
  parameters,
  onEdit,
  onDelete,
}: {
  parameters: ParameterDraft[];
  onEdit: (p: ParameterDraft) => void;
  onDelete: (p: ParameterDraft) => void;
}) {
  const columns = useMemo<ColumnDef<DataGridFeatures, ParameterDraft>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return v || <span className="text-slate-300 italic">Untitled</span>;
        },
      },
      {
        accessorKey: "description",
        header: "Description",
        size: 200,
        cell: ({ getValue }) => {
          const v = (getValue() as string) || "";
          if (!v) return <span className="text-slate-300 italic">—</span>;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block truncate max-w-[200px] text-sm text-slate-600">
                    {v}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs whitespace-normal break-words">
                  {v}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "prompt",
        header: "Prompt",
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span className="block truncate">
              {v || <span className="text-slate-300 italic">No prompt</span>}
            </span>
          );
        },
      },
      {
        id: "range",
        header: "Range / Options",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.scopeType === "numeric") {
            return (
              <Badge variant="indigo">
                {r.minValue}–{r.maxValue}
              </Badge>
            );
          }
          return (
            <div className="flex gap-1 flex-wrap">
              {r.options.map((op, i) => (
                <Badge variant="indigo" key={i}>
                  {op.label}
                </Badge>
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(row.original)}
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-teal-600"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(row.original)}
              className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [onEdit, onDelete],
  );

  const pageSize = Math.max(parameters.length, 1);
  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: parameters,
    pageCount: 1,
    getRowId: (row) => row.id,
    state: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  return (
    <DataGrid
      table={table}
      recordCount={parameters.length}
      emptyMessage={
        <span className="text-sm text-slate-400 italic">
          No parameters yet — optional, but useful for multi-criteria scoring.
        </span>
      }
      tableLayout={contiqTableLayout}
      tableClassNames={contiqTableClassNames}
    >
      <DataGridContainer className={contiqTableContainerClassName}>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}