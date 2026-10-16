import { ArticleSummary } from "@/admin/utils/types";
import ArticlesTableContent from "./ArticlesTableContent";

type ArticlesTableProps = {
  articles: ArticleSummary[];
  onRowClick?: (id: string) => void;
  statusCounts?: {
    total: number;
    approved: number;
    pending: number;
    rewrite_required: number;
    failed: number;
  } | null;
  onFetchMore?: () => void;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onReevaluated?: (articleId: string) => void;
  /** Called after an admin adds / edits / removes a published link, so the list can refresh. */
  onPublishedLinkChanged?: () => void;
  timedOutIds?: Set<string>;
  onCheckAgain?: (articleId: string) => void;
};

export default function ArticlesTable(props: ArticlesTableProps) {
  return <ArticlesTableContent {...props} />;
}
