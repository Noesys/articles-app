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
  suggested_title?: string | null;
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
  article_type_id?: string;
  article_type_name?: string | null;
}

export type ParameterResult = {
  parameter_name: string;
  parameter_description?: string | null;
  scope_type: string;
  max_value?: number | null;
  value: string | number | null;
  feedback?: string | null;
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

export interface ArticleRow {
  article: Omit<ArticleListItem, "authorName">;
  author?: { id: string; name: string };
}

// smart paste
export interface SmartPasteOptions {
  /**
   * Legacy: convert http(s) images to base64 after paste.
   * Default false — R2 uploads handle binary; remote https srcs stay as URLs.
   */
  inlineRemoteImages: boolean;
  /**
   * Pasted/dropped images upload to R2 in a fire-and-forget async block, so
   * the caller needs to know when one starts/ends to hold off letting the
   * user submit mid-upload — otherwise a not-yet-inserted image is silently
   * missing from the submitted content. Called once per file, and paired
   * (every start eventually gets a matching end, success or failure).
   */
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
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
 *    `clipboardData.files`, those files are uploaded to R2 and inserted as
 *    `/api/images/...` URLs so D1 never stores base64.
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
  auth_role: "admin" | "user";
};

export type MeResponse = AuthUser & { is_active: boolean };

export type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
};
