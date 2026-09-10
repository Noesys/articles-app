import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import MyArticles from "./screens/MyArticles";
import ArticleCreation from "./screens/ArticleCreation";
import ArticleDetail from "./screens/ArticleDetail";

import type { ReactNode } from "react";
import { RoleBasedRoute } from "./components/RoleBasedRoute";
import { UnauthorizedPage } from "./components/UnauthorizedPage";
import AllArticles from "./admin/pages/articles/AllArticles";
import UsersPage from "./admin/pages/users/UsersPage";
import ArticleTypesPage from "./admin/pages/articleTypes/ArticleTypesPage";

import AdminHeader from "./admin/components/AdminHeader";
import AdminArticleDetail from "./admin/components/articles/AdminArticleDetail";
import ArticleTypesForm from "./admin/components/articleTypes/ArticleTypesForm";
import InsightsPage from "./admin/pages/insights/InsightsPage";
import Footer from "./components/Footer";

function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminHeader />
        <div className="flex-1 min-w-0">{children}</div>
        <Footer />
      </div>
    </div>
  );
}

function UserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  if (!user) return <UnauthorizedPage />;
  return <>{children}</>;
}

function RootRouteRedirect() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-slate-400" />
      </div>
    );
  if (!user) return <UnauthorizedPage />;
  if (user.auth_role === "admin" || user.auth_role === "super_admin")
    return <Navigate to="/admin/articles" replace />;
  return (
    <UserLayout>
      <MyArticles />
    </UserLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRouteRedirect />} />

      <Route
        path="/articles/new"
        element={
          <ProtectedRoute>
            <UserLayout>
              <ArticleCreation />
            </UserLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/articles/:id/history/:version"
        element={
          <ProtectedRoute>
            <UserLayout>
              <ArticleDetail />
            </UserLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/articles/:id"
        element={
          <ProtectedRoute>
            <UserLayout>
              <ArticleDetail />
            </UserLayout>
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin/my-article"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <MyArticles />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin/articles"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <AllArticles />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin/:id/articles"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <AllArticles />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin/articles/:id"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <AdminArticleDetail />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <UsersPage />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />
      <Route
        path="/admin/article-types"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <ArticleTypesPage />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin/article-types/new"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <ArticleTypesForm />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin/article-types/:id/edit"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <ArticleTypesForm />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route
        path="/admin/insights"
        element={
          <RoleBasedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminLayout>
              <InsightsPage />
            </AdminLayout>
          </RoleBasedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
