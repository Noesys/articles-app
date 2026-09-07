import { ConfigProvider, theme as antdTheme } from "antd";
import { ArticleSummary } from "@/admin/utils/types";
import ArticlesTableContent from "./ArticlesTableContent";

type ArticlesTableProps = {
  articles: ArticleSummary[];
  onRowClick?: (id: string) => void;
};

export default function ArticlesTable(props: ArticlesTableProps) {
  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#534ab7",
          borderRadius: 8,
        },
        components: {
          Table: {
            headerBg: "#e2e8f0",
            headerColor: "#1e293b",
            headerSplitColor: "#cbd5e1",
          },
        },
      }}
    >
      <ArticlesTableContent {...props} />
    </ConfigProvider>
  );
}
