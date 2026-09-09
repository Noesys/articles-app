export type Bindings = {
  DB: D1Database;
  DEV_USER_MAIL?: string;
  ENVIRONMENT?: string;
  GENERATIVE_AI_API_KEY: string;
  ALLOWED_EMAIL_DOMAIN: string;
  // email domain for email validation in the middleware.
  
  FRONTEND_URL: string;
  AI: Ai;
  AI_PROVIDER: string;
  AI_MODEL: string;
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
