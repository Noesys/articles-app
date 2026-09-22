import { Compass, Home, LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import logoImage from "../Logo/contiq.png";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home, to: "/", activeMatch: ["/"] },
  { key: "explore", label: "Explore Articles", icon: Compass, to: "/explore", activeMatch: ["/explore"] },
];

const navLinkClass = (isActive: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-sm px-2.5 py-2 text-sm font-medium outline-none transition-[color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-contiq)] focus-visible:ring-3 focus-visible:ring-ring/50",
    isActive
      ? "bg-teal-600 text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );

export default function Header() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  function logout() {
    window.location.href = "/cdn-cgi/access/logout";
  }

  return (
    <header
      className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-[var(--shadow-card)]"
      style={{ minHeight: "var(--header-height)" }}
    >
      <div
        className="flex w-full items-center justify-between gap-3 px-[var(--page-pad-x)] md:px-[var(--page-pad-x-md)]"
        style={{ height: "var(--header-height)" }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <img
            src={logoImage}
            alt="Contiq"
            className="h-8 w-auto shrink-0 object-contain"
          />
          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              // Exact match for "/" so it isn't active on every route.
              const isActive =
                item.to === "/"
                  ? pathname === "/"
                  : item.activeMatch.some((prefix) => pathname.startsWith(prefix));
              return (
                <NavLink key={item.key} to={item.to} className={navLinkClass(isActive)}>
                  <Icon size={15} aria-hidden />
                  <span className="hidden sm:inline">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-3">
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
