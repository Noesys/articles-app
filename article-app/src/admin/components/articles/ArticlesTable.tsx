import { ArticleSummary } from "@/admin/utils/types";
import ArticlesTableContent from "./ArticlesTableContent";

type ArticlesTableProps = {
  articles: ArticleSummary[];
  onRowClick?: (id: string) => void;
  totalCount?: number
};

export default function ArticlesTable(props: ArticlesTableProps) {
  return <ArticlesTableContent {...props} />;
}
