import { useEffect, useState, WheelEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { ConfigProvider, Table, theme as antdTheme } from "antd";
import Button from "../../components/ui/Button";
import DeleteConfirmation from "./DeleteConfirmation";
import { tokenStorage } from "@/http-client";
import Badge from "../../components/ui/Badge";
import {
  ArticleTypeResponse,
  FormState,
  ParameterDraft,
  ParameterResponse,
  ScopeType,
} from "@/admin/utils/types";
import ArticleTypesParameterModal from "./ArticleTypesParameterModal";

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  promptContent: "",
  scoreMin: "0",
  scoreMax: "10",
  passThreshold: "10",
  parameters: [],
};

const EMPTY_PARAM_DRAFT: Omit<ParameterDraft, "id" | "isNew"> = {
  name: "",
  prompt: "",
  scopeType: "numeric",
  minValue: "0",
  maxValue: "10",
  options: [],
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function parameterFromResponse(p: ParameterResponse): ParameterDraft {
  return {
    id: p.id,
    name: p.name,
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
      prompt: p.prompt.trim(),
      scopeType: "numeric",
      minValue: Number(p.minValue),
      maxValue: Number(p.maxValue),
    };
  return {
    name: p.name.trim(),
    prompt: p.prompt.trim(),
    scopeType: "option",
    options: p.options,
  };
}

export default function ArticleTypesForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const token = tokenStorage.get();
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

  useEffect(() => {
    if (!id) return;
    async function loadArticleType() {
      setLoading(true);
      try {
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const [typeRes, paramsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/article-types/${id}`, {
            credentials: "include",
            headers,
          }),
          fetch(`${BACKEND_URL}/api/article-types/${id}/parameters`, {
            credentials: "include",
            headers,
          }),
        ]);
        if (!typeRes.ok) throw new Error("Failed to load article type");
        if (!paramsRes.ok) throw new Error("Failed to load parameters");
        const typeJson: { data: ArticleTypeResponse } = await typeRes.json();
        const paramsJson: { data: ParameterResponse[] } =
          await paramsRes.json();
        const t = typeJson.data;
        setForm({
          name: t.name,
          description: t.description ?? "",
          promptContent: t.score_prompt,
          scoreMin: t.score_min.toString(),
          scoreMax: t.score_max.toString(),
          passThreshold: t.pass_threshold.toString(),
          parameters: paramsJson.data.map(parameterFromResponse),
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
  const scoreRangeInvalid =
    form.scoreMin !== "" && form.scoreMax !== "" && scoreMaxNum <= scoreMinNum;
  const thresholdInvalid =
    !scoreRangeInvalid &&
    form.passThreshold !== "" &&
    (passThresholdNum < scoreMinNum || passThresholdNum > scoreMaxNum);
  const canSubmit =
    form.name.trim() &&
    form.promptContent.trim() &&
    !scoreRangeInvalid &&
    !thresholdInvalid &&
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
        scorePrompt: form.promptContent.trim(),
        scoreMin: scoreMinNum,
        scoreMax: scoreMaxNum,
        passThreshold: passThresholdNum,
      });
      let articleTypeId = id;
      if (isEditing) {
        const res = await fetch(`${BACKEND_URL}/api/article-types/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body,
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const res = await fetch(`${BACKEND_URL}/api/article-types`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body,
        });
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        articleTypeId = json.data.id;
      }
      await Promise.all(
        removedParameterIds.map((paramId) =>
          fetch(
            `${BACKEND_URL}/api/article-types/${articleTypeId}/parameters/${paramId}`,
            {
              method: "DELETE",
              credentials: "include",
              headers: { Authorization: `Bearer ${token}` },
            },
          ),
        ),
      );
      await Promise.all(
        form.parameters.map((p) => {
          const paramBody = JSON.stringify(parameterToBody(p));
          if (p.isNew)
            return fetch(
              `${BACKEND_URL}/api/article-types/${articleTypeId}/parameters`,
              {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: paramBody,
              },
            );
          return fetch(
            `${BACKEND_URL}/api/article-types/${articleTypeId}/parameters/${p.id}`,
            {
              method: "PATCH",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
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
    <div className="w-full px-4 md:px-8 py-5">
      <button
        type="button"
        onClick={() => navigate("/admin/article-types")}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
      >
        <ChevronLeft size={16} /> Back to Article Types
      </button>

      <div className="mb-5">
        <h1 className="text-3xl font-semibold text-slate-900">
          {isEditing ? "Edit Article Type" : "New Article Type"}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            placeholder="e.g. Marketing, Software, HR"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="grid grid-cols-10 gap-4">
          <div className="col-span-7">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((c) => ({ ...c, description: e.target.value }))
              }
              placeholder="Short description (optional)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Pass Threshold
            </label>
            <input
              type="number"
              value={form.passThreshold}
              onWheel={handleWheel}
              // onChange={(e) =>
              //   setForm((c) => ({ ...c, passThreshold: e.target.value }))
              // }
              onChange={(e) => {
                const value = Number(e.target.value);

                if (value > 10) return;
                if (value < 1 && e.target.value !== "") return;

                setForm((c) => ({
                  ...c,
                  passThreshold: e.target.value,
                }));
              }}
              placeholder="10"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
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
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Parameters
            </label>
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={13} />}
              type="button"
              onClick={openAddModal}
            >
              Add parameter
            </Button>
          </div>

          <ConfigProvider
            theme={{
              algorithm: antdTheme.defaultAlgorithm,
              token: { colorPrimary: "#534ab7", borderRadius: 8 },
              components: {
                Table: {
                  headerBg: "#e2e8f0",
                  headerColor: "#1e293b",
                  headerSplitColor: "#cbd5e1",
                },
              },
            }}
          >
            <Table
              dataSource={form.parameters}
              rowKey="id"
              pagination={false}
              locale={{
                emptyText: (
                  <span className="text-sm text-slate-400 italic">
                    No parameters yet — optional, but useful for multi-criteria
                    scoring.
                  </span>
                ),
              }}
              columns={[
                {
                  title: "Name",
                  dataIndex: "name",
                  key: "name",
                  render: (v: string) =>
                    v || (
                      <span className="text-slate-300 italic">Untitled</span>
                    ),
                },
                {
                  title: "Prompt",
                  dataIndex: "prompt",
                  key: "prompt",
                  ellipsis: true,
                  render: (v: string) =>
                    v || (
                      <span className="text-slate-300 italic">No prompt</span>
                    ),
                },
                {
                  title: "Range / Options",
                  key: "range",
                  render: (_: unknown, r: ParameterDraft) =>
                    r.scopeType === "numeric" ? (
                      <Badge variant="indigo">
                        {r.minValue}–{r.maxValue}
                      </Badge>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {r.options.map((op, i) => (
                          <Badge variant="indigo" key={i}>
                            {op.label}
                          </Badge>
                        ))}
                      </div>
                    ),
                },
                {
                  title: "",
                  key: "actions",
                  width: 80,
                  render: (_: unknown, r: ParameterDraft) => (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(r)}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(r)}
                        className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ),
                },
              ]}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                overflow: "hidden",
              }}
            />
          </ConfigProvider>
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
    </div>
  );
}
