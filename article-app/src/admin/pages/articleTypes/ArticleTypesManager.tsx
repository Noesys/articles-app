import { useMemo, useState } from "react";
import { Plus, Search, Tag } from "lucide-react";

import DeleteConfirmation from "../../components/articleTypes/DeleteConfirmation";
import ArticleTypeCard from "../../components/articleTypes/ArticleTypeCard";
import EmptyState from "../../components/ui/EmptyState";
import { useNavigate } from "react-router-dom";
import { ArticleTypeWithPrompt } from "@/admin/utils/types";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/reui/autocomplete";

type ArticleTypesManagerProps = {
  articleTypes: ArticleTypeWithPrompt[];
  loading?: boolean;
  onDelete?: (id: string) => void | Promise<void>;
};

/** Mirrors an ArticleTypeCard's collapsed row so the skeleton doesn't shift layout once data arrives. */
function ArticleTypeCardSkeleton() {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5 bg-teal-25">
      <Skeleton className="h-9 w-9 shrink-0 rounded-sm" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <Skeleton className="h-4 w-4 shrink-0 rounded-sm" />
    </div>
  );
}

export default function ArticleTypesManager({
  articleTypes,
  loading = false,
  onDelete,
}: ArticleTypesManagerProps) {
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

  const searchItems = useMemo(
    () =>
      articleTypes.map((t) => ({
        id: t.id,
        value: t.name,
      })),
    [articleTypes],
  );

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
        subtitle={
          loading
            ? "Loading…"
            : `${articleTypes.length} ${articleTypes.length === 1 ? "type" : "types"}`
        }
        actions={
          <Button type="button" size="lg" onClick={() => navigate("/admin/article-types/new")}>
            <Plus size={16} />
            New type
          </Button>
        }
      />

      <FilterToolbar>
        <div className="relative w-full flex-1">
          <Autocomplete
            items={searchItems}
            value={query}
            onValueChange={(value) => setQuery(value ?? "")}
            itemToStringValue={(item) => (typeof item === "string" ? item : item.value)}
          >
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-slate-400"
              />
              <AutocompleteInput
                placeholder="Search article types..."
                size="lg"
                className="rounded-sm border-border bg-white pl-9"
                showClear
                aria-label="Search article types"
              />
            </div>
            <AutocompleteContent>
              <AutocompleteEmpty>No article types found.</AutocompleteEmpty>
              <AutocompleteList>
                {(item) => (
                  <AutocompleteItem key={item.id} value={item}>
                    {item.value}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>
      </FilterToolbar>

      <div className="w-full">
        {loading ? (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-[var(--shadow-card)]">
            {Array.from({ length: 5 }).map((_, i) => (
              <ArticleTypeCardSkeleton key={i} />
            ))}
          </div>
        ) : articleTypes.length === 0 ? (
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