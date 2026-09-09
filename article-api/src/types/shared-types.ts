export type Bindings = {
  DB: D1Database;
  DEV_USER_MAIL?: string;
  ENVIRONMENT?: string;
  /** Required when AI_PROVIDER=google; unused for workers-ai */
  GENERATIVE_AI_API_KEY?: string;
  ALLOWED_EMAIL_DOMAIN: string;
  /** Optional exact origin for CORS; same-origin SPA deploy does not need it */
  FRONTEND_URL?: string;
  AI: Ai;
  AI_PROVIDER: string;
  AI_MODEL: string;
  /** Static assets binding when run_worker_first serves SPA from the Worker */
  ASSETS?: Fetcher;
  /** e.g. https://your-team.cloudflareaccess.com — for JWT fallback with assets */
  CF_ACCESS_TEAM_DOMAIN?: string;
  /** Access application AUD tag — for JWT fallback with assets */
  CF_ACCESS_AUD?: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  job_role: string;
  auth_role: string; // "user" | "admin" | "super_admin"
  is_active: number;
};

export type AppVariables = {
  user: AuthenticatedUser;
};

export type AppEnv = {
  Bindings: Bindings;
  Variables: AppVariables;
};

export type ResolvedUser = {
  id: string;
  email: string;
  name: string;
  job_role: string;
  auth_role: string;
  is_active: number;
};

export type ResolveResult =
  | { ok: true; user: ResolvedUser }
  | { ok: false; status: 401 | 403; message: string };
