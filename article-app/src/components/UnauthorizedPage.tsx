import { ShieldAlert, ArrowLeft, LogOut, Lock } from "lucide-react";
import logoImage from "../Logo/contiq.png";
import { useAuth } from "../contexts/AuthContext";

interface UnauthorizedPageProps {
  title?: string;
  message?: string;
}

export function UnauthorizedPage({
  title = "Access Restricted",
  message = "You do not have permission to view this page or your session has expired.",
}: UnauthorizedPageProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      {/* Top Header - matches Header.tsx */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="w-full px-4 md:px-8 h-13 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Logo" className="h-13 w-26" />
          </div>
          {user && (
            <span className="text-sm text-slate-500 hidden sm:block">
              {user.email} ({user.auth_role})
            </span>
          )}
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center flex flex-col items-center">
          {/* Icon Badge */}
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center mb-6 shadow-sm">
            <ShieldAlert className="w-8 h-8 text-amber-600" />
          </div>

          {/* Heading & Text */}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">
            {message}
          </p>

          {/* Additional Info Pill if logged in */}
          {user && (
            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-6 text-left text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-slate-700">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Account Status
              </div>
              <p>Logged in as: <span className="font-semibold text-slate-900">{user.email}</span></p>
              <p>Role: <span className="capitalize font-semibold text-slate-900">{user.auth_role}</span></p>
            </div>
          )}
        </div>
      </main>
          
    </div>
  );
}