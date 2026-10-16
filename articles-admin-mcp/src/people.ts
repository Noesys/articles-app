import type { ArticleApi } from "./api.js";
import type { AdminUser, ArticleSummary } from "./types.js";

/** The API has no search endpoint, so matching happens here over the admin user list. */
export async function findPeople(api: ArticleApi, query: string): Promise<AdminUser[]> {
  const users = await api.getJson<AdminUser[]>("/api/admin/users");
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const exact = users.filter((u) => u.id.toLowerCase() === q || u.email?.toLowerCase() === q);
  if (exact.length) return exact;

  return users.filter(
    (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q),
  );
}

export async function getPerson(api: ArticleApi, userId: string): Promise<AdminUser> {
  return api.getJson<AdminUser>(`/api/admin/users/${encodeURIComponent(userId)}`);
}

/** Returns the most recently submitted article, or null if the person has none. */
export async function getLatestArticle(api: ArticleApi, userId: string): Promise<ArticleSummary | null> {
  const list = await api.getJson<ArticleSummary[] | { articles?: ArticleSummary[] }>(
    `/api/admin/users/${encodeURIComponent(userId)}/articles`,
    { limit: 100 },
  );
  const articles = Array.isArray(list) ? list : (list.articles ?? []);
  if (!articles.length) return null;

  return [...articles].sort((a, b) => {
    const ta = Date.parse(a.submitted_at ?? "") || 0;
    const tb = Date.parse(b.submitted_at ?? "") || 0;
    return tb - ta;
  })[0];
}
