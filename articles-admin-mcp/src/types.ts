/** Shapes based on the API docs and DBML in the repo README. Fields are read defensively. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  job_role?: string | null;
  auth_role?: string | null;
  is_active?: number | boolean | null;
}

export interface ArticleSummary {
  id: string;
  title: string;
  status?: string | null;
  ai_score?: number | null;
  version?: number | null;
  submitted_at?: string | null;
  article_type_name?: string | null;
}

export interface ArticleDetail {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  status?: string | null;
  ai_score?: number | null;
  ai_feedback?: string | null;
  suggested_title?: string | null;
  pass_threshold?: number | null;
  version?: number | null;
  submitted_at?: string | null;
  scored_at?: string | null;
  article_type_name?: string | null;
  author_name?: string | null;
  author_email?: string | null;
  job_role?: string | null;
  [key: string]: unknown;
}

export interface ParameterResult {
  parameterName?: string;
  name?: string;
  scopeType?: string;
  value?: number | string | null;
  score?: number | string | null;
  feedback?: string | null;
  [key: string]: unknown;
}

export interface HistoryEntry {
  article_id?: string;
  version?: number;
  title?: string;
  content?: string;
  score?: number | null;
  feedback?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  snapshotted_at?: string | null;
  article_type_name?: string | null;
}

export interface ArticleBundle {
  article: ArticleDetail;
  parameter_results: ParameterResult[];
  history: HistoryEntry[];
}
