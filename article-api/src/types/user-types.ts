export interface AIEvaluationResult {
  score: number;
  feedback: string;
  parameters: Record<string, string | number>;
}

export type User = {
  id: string;
  email: string;
  name: string;
  auth_role: string;
  job_role: string;
  created_at: string;
  created_by: string | null;
  is_active: number;
};

// articles

export type ArticleHistory = {
  id: string;
  article_id: string;
  article_type_id: string;
  title: string;
  ai_feedback: string | null;
  content: string;
  ai_score: number | null;
  status: "approved" | "rewrite_required" | "pending" | "failed" | null;
  version: number;
  submitted_at: string;
  scored_at: string | null;
  snapshotted_at: string;
};

export type Article = {
  id: string;
  user_id: string;
  article_type_id: string;
  article_type_name: string;
  title: string;
  content: string;
  status: string;
  ai_score: number | null;
  version: number;
  submitted_at: string;
  scored_at: string | null;
  month_year: string;
  retry_count: number;
  ai_feedback: string | null;
};

export type ArticlePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// article types
export type ArticleType = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

// evaluation
// Database helpers for evaluation system

export type ArticleTypeConfig = {
  id: string;
  name: string;
  description: string | null;
  score_prompt: string;
  score_min: number;
  score_max: number;
  pass_threshold: number;
  is_active: number;
};

export type ParameterConfig = {
  id: string;
  article_type_id: string;
  name: string;
  prompt: string;
  scope_type: "numeric" | "option";
  min_value: number | null;
  max_value: number | null;
  is_active: number;
  sort_order: number;
  options: ParameterOption[]; // only populated when scope_type = 'option'
};

export type ParameterOption = {
  id: string;
  parameter_id: string;
  label: string;
  is_active: number;
  sort_order: number;
};

// otp
export type OtpCode = {
  id: string;
  email: string;
  code: string;
  purpose: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
};

// evaluation
export interface ParameterResultInput {
  parameter_id: string;
  value: string;
  option_id: string | null;
  numeric_value: number | null;
}

export interface EvaluationOutcome {
  ai_score: number;
  ai_feedback: string;
  status: "approved" | "rewrite_required";
  pass_threshold: number;
  parameter_results: ParameterResultInput[];
}
