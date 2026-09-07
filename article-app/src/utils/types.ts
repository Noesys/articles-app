export type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface ArticleDetail {
  id: string;
  title: string;
  content: string;
  article_type_id: string;
  article_type_name: string;
  status: string;
  version: number;
}

export interface HistoryItem {
  article_id: string;
  version: number;
  title: string;
  content: string;
  score: number | null;
  feedback: string | null;
  status: "approved" | "rewrite_required" | "pending" | "failed";
  submitted_at: string;
  snapshotted_at?: string;
}

export type ParameterResult = {
  parameter_name: string;
  scope_type: string;
  value: string | number | null;
};
export interface ArticleDetailResponse {
  article: ArticleDetail;
  current_feedback: string;
  current_score: number | null;
  history: HistoryItem[];
  parameter_results?: ParameterResult[];
}

// useMyArticles

export interface ArticleListItem {
  id: string;
  title: string;
  type: string;
  version: number;
  ai_score: number | null;
  ai_feedback?: string | null;
  status: string;
  created: string;
  authorName?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UseMyArticlesOptions {
  month?: string;
  viewAll?: boolean;
  page?: number;
  limit?: number;
}

export interface ArticleRow {
  article: Omit<ArticleListItem, "authorName">;
  author?: { id: string; name: string };
}

// smart paste
export interface SmartPasteOptions {
  /** Convert http(s) images to base64 after paste. Default true. */
  inlineRemoteImages: boolean;
}

/**
 * SmartPaste
 * ----------
 * One paste handler that covers the two cases we care about:
 *
 * 1. Rich document paste (Microsoft Word, Outlook, Google Docs, web page):
 *    clipboard carries `text/html`. We clean the Office junk and insert the
 *    WHOLE document — headings, lists, tables, bold/italic and images.
 *    If Word gave us dead `file:///` image links but also put the bitmaps in
 *    `clipboardData.files`, those files are inserted as base64 instead so no
 *    image is lost.
 *
 * 2. Markdown paste (a .md file's text, including `![alt](data:image/png;base64,…)`):
 *    clipboard carries only `text/plain` that looks like markdown. We render it
 *    with `marked` and insert the resulting HTML, so the editor and the Preview
 *    tab both show formatted markdown plus the inline images.
 *
 */

// auth context

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  job_role: string;
  auth_role: "super_admin" | "admin" | "user";
};

export type RequestOtpResponse = {
  expires_in: number;
  devOtp: string;
};

export type VerifyOtpResponse = {
  token: string;
  user: AuthUser;
};

export type MeResponse = AuthUser & { is_active: boolean };

export type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  requestOTP: (email: string) => Promise<RequestOtpResponse>;
  verifyOTP: (email: string, code: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
};
