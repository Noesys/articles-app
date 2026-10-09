import { useEffect, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/http-client";
import Button from "../ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getSafePublishedUrl,
  publishedLinkHost,
  truncateUrl,
} from "@/components/PublishedLink";

type TargetArticle = { id: string; title: string; published_url?: string | null };

/** Sets (or, with null, clears) the link. Never touches version/status/"Last evaluated at". */
function savePublishedUrl(articleId: string, url: string | null) {
  return api(`/admin/articles/${articleId}/published-url`, {
    method: "PUT",
    body: JSON.stringify({ url }),
  });
}

const iconButtonClass =
  "inline-flex rounded-md p-1.5 text-slate-500 transition-colors outline-none hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-teal-500/40";

/**
 * Admin-only Published cell: "+" when there's no link; otherwise open-link,
 * edit and delete icons. Clicks stop propagating so they don't also trigger
 * the row's own click (navigate to the article).
 */
export function AdminPublishedLinkCell({
  url,
  onAdd,
  onEdit,
  onDelete,
}: {
  url?: string | null;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const safeUrl = getSafePublishedUrl(url);

  if (!safeUrl) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className={`${iconButtonClass} hover:text-teal-600`}
        title="Add published link"
        aria-label="Add published link"
      >
        <Plus size={16} aria-hidden />
      </button>
    );
  }

  const host = publishedLinkHost(safeUrl);

  return (
    <TooltipProvider>
      <span className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open published article on ${host}`}
              className={`${iconButtonClass} hover:text-teal-600`}
            >
              <ExternalLink size={16} aria-hidden />
            </a>
          </TooltipTrigger>
          <TooltipContent>{truncateUrl(safeUrl)}</TooltipContent>
        </Tooltip>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={`${iconButtonClass} hover:text-teal-600`}
          title="Edit published link"
          aria-label="Edit published link"
        >
          <Pencil size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={`${iconButtonClass} hover:text-red-600`}
          title="Remove published link"
          aria-label="Remove published link"
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </span>
    </TooltipProvider>
  );
}

/** Add / edit modal. `article` null = closed. */
export function PublishedLinkEditDialog({
  article,
  onClose,
  onSaved,
}: {
  article: TargetArticle | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(getSafePublishedUrl(article?.published_url));

  useEffect(() => {
    if (article) {
      setDraft(getSafePublishedUrl(article.published_url) ?? "");
      setError(null);
    }
  }, [article]);

  async function handleSave() {
    if (!article) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Enter a link, or use the delete button to remove it.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setError("Link must start with http:// or https://");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePublishedUrl(article.id, trimmed);
      toast.success(isEdit ? "Published link updated" : "Published link added");
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(article)} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit published link" : "Add published link"}</DialogTitle>
          <DialogDescription className="line-clamp-2">
            Where "{article?.title}" was published.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <input
            type="url"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            disabled={busy}
            placeholder="https://…"
            aria-label="Published link"
            aria-invalid={Boolean(error)}
            autoFocus
            className="w-full rounded-sm border border-border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-w-[90px]"
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} loading={busy} className="min-w-[90px]">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete confirmation. `article` null = closed. */
export function PublishedLinkDeleteDialog({
  article,
  onClose,
  onDeleted,
}: {
  article: TargetArticle | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!article) return;
    setBusy(true);
    try {
      await savePublishedUrl(article.id, null);
      toast.success("Published link removed");
      onDeleted();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(article)} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
            <Trash2 size={18} className="text-red-600" aria-hidden />
          </div>
          <DialogTitle>Remove published link?</DialogTitle>
          <DialogDescription>
            This removes the link from "{article?.title}". The article itself isn't
            changed, and you can add a link again at any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-w-[90px]"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={() => void handleDelete()}
            loading={busy}
            className="min-w-[90px]"
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
