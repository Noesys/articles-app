import Header from "../components/Header";
import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { FilterSelect } from "@/components/ui/filter-select";
import { ChevronLeft, Send, Loader2 } from "lucide-react";
import { api } from "../http-client";
import { useAuth } from "@/contexts/AuthContext";
import AdminHeader from "@/admin/components/AdminHeader";
import { serializeArticleContent } from "@/utils/serializeArticleContent";

const TiptapEditor = lazy(() => import("@/components/editor/TiptapEditor"));
const ArticleViewer = lazy(
  () => import("@/components/shadcnEditor/ArticleViewer"),
);

function EditorFallback() {
  return (
    <div className="min-h-[240px] flex items-center justify-center rounded-sm border border-slate-200 bg-white">
      <Loader2 size={22} className="animate-spin text-slate-400" />
    </div>
  );
}

type CreateResponse = { id: string; status: string };
type FormValues = { article_type_id: string; title: string; content: string };
type ArticleType = { id: string; name: string; description: string | null };

export default function ArticleCreation() {
  const navigate = useNavigate();
  const [types, setTypes] = useState<ArticleType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>({
    article_type_id: "",
    title: "",
    content: "",
  });
  const [editorView, setEditorView] = useState<"editor" | "preview">("editor");
  const { user } = useAuth();
  useEffect(() => {
    let active = true;

    async function loadArticleTypes() {
      try {
        const result = await api<ArticleType[]>("/article-types");
        if (active) setTypes(result);
      } catch (err) {
        if (active) {
          setTypesError(
            err instanceof Error ? err.message : "Failed to load article types",
          );
        }
      } finally {
        if (active) setLoadingTypes(false);
      }
    }

    loadArticleTypes();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!values.article_type_id) {
      setError("Please select an article type");
      return;
    }

    if (!types.some((t) => t.id === values.article_type_id)) {
      setError("Please select a valid article type");
      return;
    }

    if (!values.title.trim()) {
      setError("Please enter a title");
      return;
    }

    if (!values.content.trim()) {
      setError("Please enter content");
      return;
    }

    setSubmitting(true);
    try {
      await api<CreateResponse>("/articles", {
        method: "POST",
        body: JSON.stringify({
          article_type_id: values.article_type_id,
          title: values.title.trim(),
          content: serializeArticleContent(values.content.trim()),
        }),
      });
      try {
        sessionStorage.removeItem("toastError");
        sessionStorage.setItem(
          "toast",
          "Article submitted! Scoring in progress...",
        );
      } catch {}
      navigate(
        user?.auth_role === "admin" || user?.auth_role === "super_admin"
          ? "/admin/my-article"
          : "/",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit article");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {user?.auth_role === "user" ? <Header /> : <AdminHeader />}

      <div className="w-full px-4 md:px-8 py-5">
        <button
          onClick={() =>
            navigate(
              user?.auth_role === "admin" || user?.auth_role === "super_admin"
                ? "/admin/my-article"
                : "/",
            )
          }
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft size={14} />
          Back to Articles
        </button>

        <h1 className="text-2xl font-semibold text-slate-900 mb-6">
          Create New Article
        </h1>

        <div>
          {typesError && (
            <div className="mb-4 rounded-sm bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {typesError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Article Type
              </label>

              <FilterSelect
                value={values.article_type_id}
                onValueChange={(value: string) =>
                  setValues({ ...values, article_type_id: value })
                }
                options={types.map((t) => ({
                  value: t.id,
                  label: t.description
                    ? `${t.name} — ${t.description}`
                    : t.name,
                }))}
                placeholder="Select an article type"
                triggerClassName="w-full border-border bg-white shadow-sm text-slate-900"
                disabled={loadingTypes}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Title
              </label>

              <input
                type="text"
                value={values.title}
                onChange={(e) =>
                  setValues({ ...values, title: e.target.value })
                }
                placeholder="Enter article title"
                className="w-full rounded-sm border border-border bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Content
              </label>

              <div className="space-y-2">
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
                </div>

                <Suspense fallback={<EditorFallback />}>
                  {editorView === "editor" && (
                    <TiptapEditor
                      value={values.content}
                      onChange={(content) => setValues({ ...values, content })}
                    />
                  )}
                  {editorView === "preview" && (
                    <ArticleViewer content={values.content} />
                  )}
                </Suspense>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium rounded-sm py-2.5 transition-colors"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
              {submitting ? "Submitting..." : "Submit Article"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
