import { useMemo, useState } from "react";
import { Plus, Search, Tag } from "lucide-react";

import DeleteConfirmation from "../../components/articleTypes/DeleteConfirmation";
import ArticleTypeCard from "../../components/articleTypes/ArticleTypeCard";
import EmptyState from "../../components/ui/EmptyState";
import { useNavigate } from "react-router-dom";
import { ArticleTypeWithPrompt } from "@/admin/utils/types";


type ArticleTypesManagerProps = {
  articleTypes: ArticleTypeWithPrompt[];

  onDelete?: (id: string) => void | Promise<void>;
};

export default function ArticleTypesManager({
  articleTypes,
  onDelete,
}: ArticleTypesManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] =
    useState<ArticleTypeWithPrompt | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return articleTypes.filter((type) => {
      const matchesQuery =
        !normalizedQuery ||
        type.name.toLowerCase().includes(normalizedQuery) ||
        type.description?.toLowerCase().includes(normalizedQuery);

      return matchesQuery;
    });
  }, [articleTypes, query]);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setSubmitting(true);

    try {
      await onDelete?.(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="w-full px-4 md:px-8 py-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-3xl font-semibold text-slate-900 leading-tight">
          Article Types
        </h2>
        <button
          onClick={() => navigate("/admin/article-types/new")}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
        >
          <Plus size={16} />
          New Type
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 w-full">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search article types..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-9"
          />
        </div>
      </div>

      <div className="w-full">
        {articleTypes.length === 0 ? (
          <EmptyState
            icon={<Tag size={20} />}
            title={"Loading Article Types."}
            description=" Please wait..."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={20} />}
            title="No matches"
            description="Try a different search term or filter."
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {filtered.map((type) => (
              <ArticleTypeCard
                key={type.id}
                type={type}
                isExpanded={expandedId === type.id}
                onToggle={() =>
                  setExpandedId(expandedId === type.id ? null : type.id)
                }
                onEdit={() => navigate(`/admin/article-types/${type.id}/edit`)}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteConfirmation
          open={!!deleteTarget}
          name={deleteTarget.name}
          submitting={submitting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
