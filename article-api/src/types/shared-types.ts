export type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  SENDGRID_API_KEY?: string;
  FROM_EMAIL?: string;
  DEV_EMAIL?: string;
  ENVIRONMENT?: string;
  GOOGLE_GENERATIVE_AI_API_KEY: string;
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
