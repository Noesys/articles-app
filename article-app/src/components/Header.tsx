import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logoImage from "../Logo/contiq.png";

export default function Header() {
  const { user } = useAuth();
  function logout() {
    window.location.href = "/cdn-cgi/access/logout";
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="w-full px-4 md:px-8 h-13 flex items-center justify-between">
        <div className="flex items-center shrink-0">
          <img src={logoImage} alt="Logo" className="h-8 w-auto" />
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-slate-500 hidden lg:block max-w-48 truncate">
              {user.name}
            </span>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
