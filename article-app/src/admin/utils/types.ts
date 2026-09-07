export interface ArticleTypeInput {
  name: string;
  description?: string;
  passThreshold: number;
  scorePrompt: string;
  scoreMin: number;
  scoreMax: number;
}

// articles 

export type ArticleStatus =
  | "approved"
  | "rewrite_required"
  | "pending"
  | "failed"
  | "unknown";


export type ArticleParameterResult = {
  parameterId: string;
  parameterName: string;
  scopeType: "numeric" | "option";
  value: string;
};

export type ArticleSummary = {
  id: string;
  title: string;
  type: string;
  version: number;
  ai_score: number | null;
  status: ArticleStatus;
  created_at: string;
  author_name: string;
  submitted_at: string;
  month_year: string;
  parameters: ArticleParameterResult[];
};

export type ArticleRowProps = {
  article: ArticleSummary;
  onClick?: (id: string) => void;
};


// article types 

// manager page

export type Parameter = {
  id: string;
  name: string;
  scopeType: "numeric" | "option";
  options: string | null;
};

export type ArticleType = {
  id: string;
  name: string;
  description: string | null;
  is_active: number;
  pass_threshold: number;
  created_by: string;
  created_at: string;
  parameters: Parameter[];
  updated_at: string;
};

export type ArticleTypeWithPrompt = ArticleType & {
  score_prompt: string | null;
};

// components

export type ScopeType = "numeric" | "option";
export type ParameterOptionDraft = { id?: string; label: string };
export type ParameterDraft = {
  id: string;
  name: string;
  prompt: string;
  scopeType: ScopeType;
  minValue: string;
  maxValue: string;
  options: ParameterOptionDraft[];
  isNew: boolean;
};


export type FormState = {
  name: string;
  description: string;
  promptContent: string;
  scoreMin: string;
  scoreMax: string;
  passThreshold: string;
  parameters: ParameterDraft[];
};

export type ArticleTypeResponse = {
  id: string;
  name: string;
  description: string | null;
  pass_threshold: number;
  score_prompt: string;
  score_min: number;
  score_max: number;
};

export type ParameterResponse = {
  id: string;
  name: string;
  prompt: string;
  scope_type: ScopeType;
  min_value: number | null;
  max_value: number | null;
  options: ParameterOptionDraft[];
};


// users
export type AuthRole = "super_admin" | "admin" | "user";

export type User = {
  id: string;
  email: string;
  name: string;
  auth_role: AuthRole;
  job_role: string;
  created_at: string;
  is_active: number; // 1 = active, 0 = inactive
};


// insights
export interface NumericDistributionBucket {
  value: number;
  count: number;
}

export interface OptionBreakdown {
  label: string;
  count: number;
}

export interface ParameterSummary {
  parameterId: string;
  parameterName: string;
  scopeType: "numeric" | "option";
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

// employee submissoins
export interface EmployeeSubmissionRow {
  userId: string;
  name: string;
  jobRole: string;
  monthly: Record<string, number>;
  total: number;
}

export interface EmployeeSubmissionsResult {
  months: string[];
  rows: EmployeeSubmissionRow[];
  monthlyTotals: Record<string, number>;
  grandTotal: number;
}
