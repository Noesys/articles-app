import Header from "../components/Header";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, Send, Loader2 } from "lucide-react";
import { api } from "../http-client";
import TurndownService from "turndown";
import { useAuth } from "@/contexts/AuthContext";
import AdminHeader from "@/admin/components/AdminHeader";
import TiptapEditor from "@/components/editor/TiptapEditor";
import ArticleViewer from "@/components/shadcnEditor/ArticleViewer";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("table", {
  filter: "table",
  replacement: function (content) {
    return "\n" + content + "\n";
  },
});

turndown.addRule("tableHead", {
  filter: "thead",
  replacement: function (content) {
    return content;
  },
});

turndown.addRule("tableBody", {
  filter: "tbody",
  replacement: function (content) {
    return content;
  },
});

turndown.addRule("tableRow", {
  filter: "tr",
  replacement: function (content) {
    let line = "| " + content.trim() + " |";
    return line + "\n";
  },
});

turndown.addRule("tableCell", {
  filter: ["th", "td"],
  replacement: function (content) {
    return content.trim() + " | ";
  },
});

// Add IMAGE support to turndown - converts <img> to markdown ![alt](src)
turndown.addRule("image", {
  filter: "img",
  replacement: function (content, node) {
    const alt = node.getAttribute("alt") || "";
    const src = node.getAttribute("src") || "";
    return "![" + alt + "](" + src + ")";
  },
});

function toMarkdown(content: string): string {
  if (!content.trim() || content.trim() === "<p></p>") return "";

  const temp = document.createElement("div");
  temp.innerHTML = content;

  const decode = (s: string) => {
    const ta = document.createElement("textarea");
    ta.innerHTML = s;
    return ta.value;
  };

  // Detect rich HTML (from .docx paste or Tiptap formatting) vs raw markdown wrapped in <p>
  const hasRichElements = !!temp.querySelector("h1,h2,h3,ul,ol,blockquote,pre,table,strong,em,u");
  const hasImages = !!temp.querySelector("img");
  const hasTable = !!temp.querySelector("table");

  // Case 1: Rich HTML (formatted docx / Tiptap tables/bold/headings/images) -> use Turndown
  if (hasRichElements || hasImages) {
    try {
      if (hasTable) {
        const div = document.createElement("div");
        div.innerHTML = content;

        // Fix tables that might have empty headers
        div.querySelectorAll("table").forEach((tbl) => {
          const headerRow = tbl.querySelector("thead tr");
          if (!headerRow || !headerRow.querySelector("th")) {
            const firstBodyRow = tbl.querySelector("tbody tr");
            if (firstBodyRow) {
              const thead = document.createElement("thead");
              const headerTr = document.createElement("tr");
              firstBodyRow.querySelectorAll("td").forEach((td) => {
                const th = document.createElement("th");
                th.innerHTML = td.innerHTML;
                headerTr.appendChild(th);
              });
              thead.appendChild(headerTr);
              const tbody = tbl.querySelector("tbody");
              if (tbody) {
                tbl.insertBefore(thead, tbody);
                firstBodyRow.remove();
              }
            }
          }
        });

        content = div.innerHTML;
      }

      let md = turndown.turndown(content);
      md = decode(md);

      md = md
        .split("\n")
        .map((line) => {
          if (line.includes("|")) return line;
          return line.replace(/\\([#*_\-[\]`>])/g, "$1");
        })
        .join("\n");

      // Fix GFM table format: ensure delimiter row immediately follows header
      md = md.replace(/(\|[^\n]*\|)\n\s*\n\s*(\|[\s\-:|]+\|)/g, "$1\n$2");

      // Collapse multiple blank lines inside table blocks
      md = md.replace(/(\|[^\n]*\|)\n\n(?=\|)/g, "$1\n");

      // Ensure proper spacing between table and other content
      md = md.replace(/(\|[\s\-:|]+\|)\n(?!\|)/g, "$1\n\n");

      // Clean up multiple consecutive blank lines (except in tables)
      md = md.replace(/\n\n\n+/g, "\n\n");

      return md.trim();
    } catch (e) {
      console.error("Turndown error:", e);
      /* fallthrough */
    }
  }

  // Case 2: raw markdown pasted (wrapped in <p>) + optional images
  const getTextWithBreaks = (el: HTMLElement): string => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    return decode((clone.textContent ?? "").trim());
  };

  const parts: string[] = [];
  for (const node of Array.from(temp.childNodes) as ChildNode[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const tx = decode((node.textContent ?? "").trim());
      if (tx) parts.push(tx);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    const el = node as HTMLElement;

    if (el.tagName.toLowerCase() === "img") {
      const src = el.getAttribute("src") ?? "";
      const alt = el.getAttribute("alt") ?? "";
      if (src) parts.push("![" + alt + "](" + src + ")");
      continue;
    }

    const imgs = Array.from(el.querySelectorAll("img"));
    if (imgs.length > 0) {
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("img").forEach((n) => n.remove());
      clone.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      const text = decode((clone.textContent ?? "").trim());
      if (text) parts.push(text);
      for (const img of imgs) {
        const src = (img as HTMLImageElement).getAttribute("src") ?? "";
        const alt = img.getAttribute("alt") ?? "";
        if (src) parts.push("![" + alt + "](" + src + ")");
      }
      continue;
    }

    const text = getTextWithBreaks(el);
    if (!text) continue;

    if (text.includes("|") && text.includes("\n")) {
      parts.push(text);
    } else {
      parts.push(text);
    }
  }

  if (parts.length > 0) {
    let out = parts.join("\n\n").trim();
    // GFM tables must have header and delimiter on consecutive lines
    out = out.replace(/(\|[^\n]*\|)\n\s*\n(?=\|)/g, "$1\n");
    return out;
  }

  // Fallback: images at deeper nesting or Turndown for edge cases
  if (hasImages) {
    try {
      return decode(turndown.turndown(content)).trim();
    } catch {}
  }

  const raw = decode((temp as HTMLElement).innerText ?? temp.textContent ?? "");
  return raw.trim();
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
          setTypesError(err instanceof Error ? err.message : "Failed to load article types");
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
          content: toMarkdown(values.content.trim()),
        }),
      });
      try {
        sessionStorage.removeItem("toastError");
        sessionStorage.setItem("toast", "Article submitted! Scoring in progress...");
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
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft size={14} />
          Back to Articles
        </button>

        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Create New Article</h1>

        <div>
          {typesError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {typesError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Article Type
              </label>

              <Select
                value={values.article_type_id}
                onValueChange={(value: string) => setValues({ ...values, article_type_id: value })}
                disabled={loadingTypes}
              >
                <SelectTrigger className="w-full border-slate-400 bg-white shadow-sm text-slate-900 [&_span[data-placeholder]]:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <SelectValue placeholder="Select an article type" />
                </SelectTrigger>

                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.description ? `${t.name} — ${t.description}` : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Title</label>

              <input
                type="text"
                value={values.title}
                onChange={(e) => setValues({ ...values, title: e.target.value })}
                placeholder="Enter article title"
                className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Content</label>

              <div className="space-y-2">
                <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
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

                {editorView === "editor" && (
                  <TiptapEditor
                    value={values.content}
                    onChange={(content) => setValues({ ...values, content })}
                  />
                )}

                {editorView === "preview" && <ArticleViewer content={values.content} />}
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg py-2.5 transition-colors"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {submitting ? "Submitting..." : "Submit Article"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
