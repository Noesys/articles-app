import {
  ChartNoAxesCombined,
  FileText,
  LogOut,
  Menu,
  Pen,
  Tags,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import logoImage from '../../Logo/Noesys_logo.png';
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  {
    key: "Write an article",
    label: "Write An Article",
    icon: Pen,
    to: "/admin/my-article",
  },
  {
    key: "articles",
    label: "Articles",
    icon: FileText,
    to: "/admin/articles",
  },
  {
    key: "article-types",
    label: "Article Types",
    icon: Tags,
    to: "/admin/article-types",
  },
  {
    key: "users",
    label: "Users",
    icon: Users,
    to: "/admin/users",
  },
  {
    key: "insights",
    label: "Insights",
    icon: ChartNoAxesCombined,
    to: "/admin/insights",
  },
];

export default function AdminHeader({ title }: { title?: string }) {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 bg-white border-b border-slate-200 z-50">
      <div className="w-full px-4 md:px-8 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <img src={logoImage} alt="Logo" className="h-14 w-20 rounded-lg" />
          <span className="font-semibold text-slate-900 hidden sm:block">Article Platform</span>
        </div>
        {title && (
          <span className="text-sm font-medium text-slate-700 hidden xl:block truncate">
            {title}
          </span>
        )}

        <nav className="hidden lg:flex items-center gap-1 flex-1 justify-around">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-center gap-2 rounded-lg px-2 xl:px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={18} />
                <span className="hidden xl:inline">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-3 shrink-0">
          {user && (
            <span className="text-sm text-slate-500 hidden 2xl:block max-w-48 truncate">
              {user.email}
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

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="lg:hidden inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-100 bg-white px-4 py-3 shadow-lg">
          <nav className="grid gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-slate-500">{user?.email}</span>
            <button
              onClick={logout}
              className="shrink-0 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
