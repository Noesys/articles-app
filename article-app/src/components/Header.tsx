import { LogOut } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import logoImage from "../Logo/contiq.png";

export default function Header() {
  const { user } = useAuth();
  function logout() {
    window.location.href = "/cdn-cgi/access/logout";
  }

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-[var(--shadow-card)]"
      style={{ minHeight: "var(--header-height)" }}
    >
      <div
        className="flex w-full items-center justify-between px-[var(--page-pad-x)] md:px-[var(--page-pad-x-md)]"
        style={{ height: "var(--header-height)" }}
      >
        <div className="flex items-center gap-2">
          <img
            src={logoImage}
            alt="Contiq"
            className="h-9 w-auto shrink-0 object-contain"
          />
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="hidden text-sm text-slate-500 sm:block">{user.name}</span>}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm text-slate-600 outline-none transition-[color,background-color] duration-[var(--duration-fast)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogOut size={15} aria-hidden />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
