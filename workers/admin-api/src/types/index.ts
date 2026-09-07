export type Env = {
  DB: D1Database;
  DEV_EMAIL?: string;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
  SENDGRID_API_KEY?: string;
  FROM_EMAIL?: string;
};

export type AuthContext = {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string;
      job_role: string;
      auth_role: string;
      is_active: number;
    };
  };
};

export interface ArticleHistoryEntry {
  id: string;
  article_id: string;
  version: number;
  title: string;
  content: string;
  ai_score: number | null;
  ai_feedback: string | null;
  status: "approved" | "rewrite_required" | "pending" | "failed" | null;
  submitted_at: string | null;
  scored_at: string | null;
  snapshotted_at: string;
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  auth_role: "super_admin" | "admin";
  job_role: string;
  is_active: number;
};

// article types
export interface ArticleParameterResult {
  parameterId: string;
  parameterName: string;
  scopeType: string;
  value: string | number | null;
}

export interface ArticleListRawRow {
  id: string;
  title: string;
  status: string;
  ai_score: number | null;
  version: number;
  submitted_at: string;
  user_id: string;
  author_name: string;
  article_type_id: string;
  article_type_name: string;
  parameters: string;
}
export interface ArticleListResult {
  id: string;
  title: string;
  status: string;
  ai_score: number | null;
  version: number;
  submitted_at: string;
  user_id: string;
  author_name: string;
  article_type_id: string;
  article_type_name: string;
  parameters: ArticleParameterResult[];
}

export interface ArticleTypeListItem {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  pass_threshold: number;
  score_prompt: string;
  score_min: number;
  score_max: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  parameters: ParameterRow[];
  parameter_count: number;
}

export interface ArticleTypeDetail {
  id: string;
  name: string;
  description: string | null;
  pass_threshold: number;
  score_prompt: string;
  score_min: number;
  score_max: number;
  is_active: number;
}

export interface CreateArticleTypeResult {
  id: string;
}

export interface ParameterOptionRow {
  id: string;
  label: string;
  sortOrder: number;
}

export interface ParameterRow {
  id: string;
  name: string;
  prompt: string;
  scopeType: string;
  minValue: number | null;
  maxValue: number | null;
  options: ParameterOptionRow[];
}

export interface ArticleTypeListRow {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  pass_threshold: number;
  score_prompt: string;
  score_min: number;
  score_max: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  // json_group_array() returns a JSON string from SQLite, not a parsed array
  parameters: string;
  parameter_count: number;
}

export interface ArticleTypeRow {
  id: string;
  name: string;
  description: string | null;
  pass_threshold: number;
  score_prompt: string;
  score_min: number;
  score_max: number;
  is_active: number;
}

export interface ArticleTypeInput {
  name: string;
  description?: string;
  passThreshold: number;
  scorePrompt: string;
  scoreMin: number;
  scoreMax: number;
}

// users
export interface UserListItem {
  id: string;
  name: string;
  email: string;
  job_role: string;
  is_active: number;
  auth_role: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  auth_role: string;
  job_role: string;
  is_active: number;
  created_at: string;
  created_by: string;
}

export interface ArticleByUser {
  id: string;
  title: string;
  status: string;
  ai_score: number | null;
  version: number;
  submitted_at: string | null;
  user_id: string;
  author_name: string;
  article_type_id: string;
  article_type_name: string;
  parameters: unknown[];
}

export type SubmissionStatus = "submitted" | "not_submitted";

export const ALLOWED_SUBMISSION_STATUSES: SubmissionStatus[] = [
  "submitted",
  "not_submitted",
];

export type AssignableAuthRole = "user" | "admin";
export const ALLOWED_AUTH_ROLES: AssignableAuthRole[] = ["user", "admin"];

export interface UpdateUserRoleBody {
  role: string;
}

export interface UpdateUserBody {
  name: string;
  job_role: string;
  is_active: boolean;
}

export interface UpdateUserStatusBody {
  is_active: boolean;
}

export const ALLOWED_ROLES = ["user", "admin", "super_admin"] as const;

// insights
export interface DateRange {
  start: string; // 'YYYY-MM'
  end: string; // 'YYYY-MM'
}

export interface OptionBreakdown {
  label: string;
  count: number;
  sortOrder: number;
}

export interface NumericDistributionBucket {
  value: number;
  count: number;
}

export interface ParameterSummary {
  parameterId: string;
  parameterName: string;
  scopeType: "numeric" | "option";
  sortOrder: number;
  options?: OptionBreakdown[];
  numeric?: {
    avg: number;
    min: number;
    max: number;
    count: number;
    distribution: NumericDistributionBucket[];
  };
}

export interface ArticleTypeSummary {
  articleTypeId: string;
  articleTypeName: string;
  totalArticles: number;
  parameters: ParameterSummary[];
}

// parameters
export type ScopeType = "numeric" | "option";

export interface ParameterOptionInput {
  id?: string;
  label: string;
}

export interface ParameterInput {
  name: string;
  prompt: string;
  scopeType: ScopeType;
  minValue?: number;
  maxValue?: number;
  options?: ParameterOptionInput[];
}

export type Resolved = {
  id: string;
  label: string;
  sortOrder: number;
  isNew: boolean;
  oldLabel: string | null;
};

// parameter results
export interface ParameterResultRow {
  id: string;
  parameter_id: string;
  name: string;
  value: string;
  version: number;
  scored_at: string;
}

export interface StoreParameterResultInput {
  parameter_id: string;
  value: string;
}

export interface StoreParameterResultsResult {
  article_id: string;
  version: number;
  scored_at: string;
}
