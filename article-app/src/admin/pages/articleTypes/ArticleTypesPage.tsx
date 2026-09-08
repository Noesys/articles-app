import { useEffect, useState } from "react";
import ArticleTypesManager from "./ArticleTypesManager";
import { api } from "@/http-client";
import { ArticleTypeWithPrompt } from "@/admin/utils/types";

const ArticleTypesPage = () => {
  const [types, setTypes] = useState<ArticleTypeWithPrompt[]>([]);

  async function deleteArticleType(id: string) {
    await api(`/admin/article-types/${id}`, { method: "DELETE" });
  }

  async function loadArticleTypes() {
    const data = await api<ArticleTypeWithPrompt[]>(`/admin/article-types`);
    setTypes(data);
  }

  useEffect(() => {
    loadArticleTypes().catch((error) => {
      console.error(error);
    });
  }, []);

  const handleDeleteType = async (id: string) => {
    await deleteArticleType(id);
    await loadArticleTypes();
  };

  return (
    <div>
      <ArticleTypesManager articleTypes={types} onDelete={handleDeleteType} />
    </div>
  );
};

export default ArticleTypesPage;
