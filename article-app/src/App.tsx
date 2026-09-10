import { Loader2 } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { RoleBasedRoute } from "./components/RoleBasedRoute";
import { UnauthorizedPage } from "./components/UnauthorizedPage";
import AdminHeader from "./admin/components/AdminHeader";

const MyArticles = lazy(() => import("./screens/MyArticles"));
const ArticleCreation = lazy(() => import("./screens/ArticleCreation"));
const ArticleDetail = lazy(() => import("./screens/ArticleDetail"));
const AllArticles = lazy(() => import("./admin/pages/articles/AllArticles"));
const UsersPage = lazy(() => import("./admin/pages/users/UsersPage"));
const ArticleTypesPage = lazy(() => import("./admin/pages/articleTypes/ArticleTypesPage"));
const AdminArticleDetail = lazy(() => import("./admin/components/articles/AdminArticleDetail"));
const ArticleTypesForm = lazy(() => import("./admin/components/articleTypes/ArticleTypesForm"));
const InsightsPage = lazy(() => import("./admin/pages/insights/InsightsPage"));

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center bg-slate-50">
      <Loader2 size={28} className="animate-spin text-slate-400" />
    </div>
  );
}

function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row">
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminHeader />
        <div className="flex-1 min-w-0">
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </div>
      </div>
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
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
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
    <Suspense fallback={<PageFallback />}>
      <MyArticles />
    </Suspense>
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
            <ArticleCreation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/articles/:id/history/:version"
        element={
          <ProtectedRoute>
            <ArticleDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/articles/:id"
        element={
          <ProtectedRoute>
            <ArticleDetail />
          </ProtectedRoute>
        }
      />

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
