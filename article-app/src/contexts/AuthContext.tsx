import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, tokenManager } from "../http-client";
import { AuthContextValue, AuthUser, MeResponse, RequestOtpResponse, VerifyOtpResponse } from "@/utils/types";


const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) {
      return false;
    }
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(tokenManager.get());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function validate() {
      const stored = tokenManager.get();
      if (!stored || isTokenExpired(stored)) {
        tokenManager.clear();
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        const me = await api<MeResponse>("/auth/me");
        if (!active) {
          return;
        }
        setToken(stored);
        setUser({
          id: me.id,
          name: me.name,
          email: me.email,
          job_role: me.job_role,
          auth_role: me.auth_role,
        });
      } catch {
        if (active) {
          tokenManager.clear();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    validate();

    return () => {
      active = false;
    };
  }, []);

  const requestOTP = useCallback(async (email: string) => {
    return api<RequestOtpResponse>("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }, []);

  const verifyOTP = useCallback(
    async (email: string, code: string) => {
      const result = await api<VerifyOtpResponse>("/auth/otp/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      tokenManager.set(result.token);
      setToken(result.token);
      setUser(result.user);

      // Redirect based on role
      if (
        result.user.auth_role === "admin" ||
        result.user.auth_role === "super_admin"
      ) {
        navigate("/admin/articles", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    },
    [navigate],
  );

  const logout = useCallback(() => {
    tokenManager.clear();
    setToken(null);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const isAuthenticated = useCallback(() => {
    const stored = tokenManager.get();
    return !!stored && !isTokenExpired(stored);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      requestOTP,
      verifyOTP,
      logout,
      isAuthenticated,
    }),
    [user, token, loading, requestOTP, verifyOTP, logout, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
