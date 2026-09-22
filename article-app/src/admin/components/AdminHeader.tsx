import {
  ChartNoAxesCombined,
  Compass,
  FileText,
  LogOut,
  Menu,
  Pen,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import logoImage from "../../Logo/contiq.png";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
  {
    key: "articles",
    label: "Articles",
    icon: FileText,
    to: "/admin/articles",
    activeMatch: ["/admin/articles", "/articles"],
  },
  {
    key: "article-types",
    label: "Article Types",
    icon: Tags,
    to: "/admin/article-types",
    activeMatch: ["/admin/article-types"],
  },
  {
    key: "explore",
    label: "Explore Articles",
    icon: Compass,
    to: "/explore",
    activeMatch: ["/explore"],
  },
  {
    key: "users",
    label: "Users",
    icon: Users,
    to: "/admin/users",
    activeMatch: ["/admin/users"],
  },
  {
    key: "insights",
    label: "Insights",
    icon: ChartNoAxesCombined,
    to: "/admin/insights",
    activeMatch: ["/admin/insights"],
  },
];

function useIsIconOnlyRange() {
  const [isIconOnly, setIsIconOnly] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (max-width: 1279px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsIconOnly(e.matches);
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isIconOnly;
}

const navLinkClass = (isActive: boolean) =>
  cn(
    "flex items-center justify-center gap-2 rounded-sm px-2.5 xl:px-3 py-2 text-sm font-medium outline-none transition-[color,background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-contiq)] focus-visible:ring-3 focus-visible:ring-ring/50",
    isActive
      ? "bg-teal-600 text-white"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );

export default function AdminHeader({ title }: { title?: string }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isIconOnly = useIsIconOnlyRange();

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
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <img
            src={logoImage}
            alt="Contiq"
            className="h-8 w-auto shrink-0 object-contain"
          />
          {title && (
            <span className="hidden truncate text-sm font-medium text-slate-700 lg:block">
              {title}
            </span>
          )}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Admin">
            <TooltipProvider>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.activeMatch.some((prefix) =>
                  pathname.startsWith(prefix),
                );

                const navLink = (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    className={navLinkClass(isActive)}
                  >
                    <Icon size={16} aria-hidden />
                    <span className="hidden xl:inline">{item.label}</span>
                  </NavLink>
                );

                return isIconOnly ? (
                  <Tooltip key={item.key}>
                    <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                    <TooltipContent side="bottom">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  navLink
                );
              })}
            </TooltipProvider>
          </nav>
        </div>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {user && (
            <span className="hidden max-w-48 truncate text-sm text-slate-500 lg:block">
              {user.name}
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm text-slate-600 outline-none transition-[color,background-color] duration-[var(--duration-fast)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LogOut size={15} aria-hidden />
            Logout
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="inline-flex items-center justify-center rounded-sm p-2 text-slate-600 outline-none transition-[color,background-color] duration-[var(--duration-fast)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
          aria-label={
            mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
          }
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-[var(--page-pad-x)] py-3 shadow-[var(--shadow-overlay)] lg:hidden">
          <nav className="grid gap-1" aria-label="Admin mobile">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.activeMatch.some((prefix) =>
                pathname.startsWith(prefix),
              );
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium outline-none transition-[color,background-color] duration-[var(--duration-fast)] focus-visible:ring-3 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-teal-600 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <Icon size={18} aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="min-w-0 truncate text-sm text-slate-500">
              {user?.name}
            </span>
            <button
              type="button"
              onClick={logout}
              className="flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm text-slate-600 outline-none transition-[color,background-color] duration-[var(--duration-fast)] hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <LogOut size={15} aria-hidden />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
