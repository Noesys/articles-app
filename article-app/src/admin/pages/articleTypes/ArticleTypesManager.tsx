import { useMemo, useState } from "react";
import { Plus, Search, Tag } from "lucide-react";

import DeleteConfirmation from "../../components/articleTypes/DeleteConfirmation";
import ArticleTypeCard from "../../components/articleTypes/ArticleTypeCard";
import EmptyState from "../../components/ui/EmptyState";
import { useNavigate } from "react-router-dom";
import { ArticleTypeWithPrompt } from "@/admin/utils/types";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ArticleTypesManagerProps = {
  articleTypes: ArticleTypeWithPrompt[];
  onDelete?: (id: string) => void | Promise<void>;
};

export default function ArticleTypesManager({ articleTypes, onDelete }: ArticleTypesManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<ArticleTypeWithPrompt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return articleTypes.filter((type) => {
      return (
        !normalizedQuery ||
        type.name.toLowerCase().includes(normalizedQuery) ||
        type.description?.toLowerCase().includes(normalizedQuery)
      );
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
    <PageShell>
      <PageHeader
        title="Article types"
        subtitle={`${articleTypes.length} ${articleTypes.length === 1 ? "type" : "types"}`}
        actions={
          <Button type="button" size="lg" onClick={() => navigate("/admin/article-types/new")}>
            <Plus size={16} />
            New type
          </Button>
        }
      />

      <FilterToolbar>
        <div className="relative w-full flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-slate-400"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search article types..."
            aria-label="Search article types"
            className="h-9 rounded-sm border-border bg-white pl-9"
          />
        </div>
      </FilterToolbar>

      <div className="w-full">
        {articleTypes.length === 0 ? (
          <EmptyState
            icon={<Tag size={20} />}
            title="No article types yet"
            description="Create a type to define scoring parameters and prompts."
            action={
              <Button type="button" onClick={() => navigate("/admin/article-types/new")}>
                <Plus size={16} />
                New type
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={20} />}
            title="No matches"
            description="Try a different search term."
          />
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-[var(--shadow-card)]">
            {filtered.map((type) => (
              <ArticleTypeCard
                key={type.id}
                type={type}
                isExpanded={expandedId === type.id}
                onToggle={() => setExpandedId(expandedId === type.id ? null : type.id)}
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
    </PageShell>
  );
}
