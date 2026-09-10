import { useMemo, useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  useTable,
} from "@tanstack/react-table";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { AuthRole, User } from "@/admin/utils/types";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<AuthRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

type UsersTableProps = {
  users: User[];
  loading?: boolean;
  onToggleActive?: (userId: string, nextIsActive: boolean) => void | Promise<void>;
  onRoleChange?: (userId: string, nextRole: AuthRole) => void | Promise<void>;
  onUserClick?: (userId: string) => void;
};

type PendingAction =
  | { type: "status"; user: User }
  | { type: "role"; user: User; role: AuthRole }
  | null;

export default function UsersTable({
  users,
  loading = false,
  onToggleActive,
  onRoleChange,
  onUserClick,
}: UsersTableProps) {
  const { user: currentUser } = useAuth();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [pending, setPending] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);

  const canManageStatus = (target: User) =>
    !!currentUser &&
    currentUser.id !== target.id &&
    ((currentUser.auth_role === "super_admin" &&
      (target.auth_role === "admin" || target.auth_role === "user")) ||
      (currentUser.auth_role === "admin" && target.auth_role === "user"));

  const canViewArticles = (target: User) =>
    !!currentUser &&
    currentUser.id !== target.id &&
    ((currentUser.auth_role === "super_admin" &&
      (target.auth_role === "admin" || target.auth_role === "user")) ||
      (currentUser.auth_role === "admin" &&
        (target.auth_role === "admin" || target.auth_role === "user")));

  const canPromote = (target: User) => target.auth_role === "user";

  const canDemote = (target: User) =>
    !!currentUser &&
    currentUser.auth_role === "super_admin" &&
    currentUser.id !== target.id &&
    target.auth_role === "admin";

  const columns = useMemo<ColumnDef<DataGridFeatures, User>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        size: 280,
        cell: ({ row }) => {
          const u = row.original;
          const active = u.is_active === 1;
          return (
            <div className="flex items-center gap-2.5 min-w-0 py-0.5">
              <div
                className={cn(
                  "size-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold",
                  active ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500",
                )}
              >
                {getInitials(u.name)}
              </div>
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="font-semibold text-foreground truncate leading-tight">
                  {u.name}
                </span>
                <span className="text-xs text-muted-foreground truncate leading-tight">
                  {u.email}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "job_role",
        header: "Job role",
        size: 160,
        cell: ({ getValue }) => (
          <span className="truncate text-sm text-muted-foreground">
            {(getValue() as string) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "auth_role",
        header: "Role",
        size: 130,
        cell: ({ getValue }) => {
          const role = getValue() as AuthRole;
          return (
            <Badge
              variant="outline"
              className={cn(
                "font-medium border-transparent",
                role === "super_admin" && "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-300/80",
                role === "admin" && "bg-sky-50 text-sky-700 ring-1 ring-sky-200/80",
                role === "user" && "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80",
              )}
            >
              {ROLE_LABELS[role]}
            </Badge>
          );
        },
      },
      {
        id: "status",
        accessorFn: (row) => (row.is_active === 1 ? "active" : "inactive"),
        header: "Status",
        size: 110,
        cell: ({ row }) => {
          const active = row.original.is_active === 1;
          return (
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 font-medium border-transparent",
                active
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80"
                  : "bg-red-50 text-red-600 ring-1 ring-red-200/80",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  active ? "bg-emerald-500" : "bg-red-500",
                )}
              />
              {active ? "Active" : "Inactive"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        size: 300,
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original;
          const active = u.is_active === 1;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {canManageStatus(u) && (
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium shadow-none",
                    active
                      ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800",
                  )}
                  onClick={() => setPending({ type: "status", user: u })}
                >
                  {active ? <UserX className="size-3.5" /> : <UserCheck className="size-3.5" />}
                  {active ? "Deactivate" : "Activate"}
                </Button>
              )}
              {canPromote(u) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs font-medium shadow-none border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => setPending({ type: "role", user: u, role: "admin" })}
                >
                  <ArrowUpCircle className="size-3.5" />
                  Promote
                </Button>
              )}
              {canDemote(u) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-xs font-medium shadow-none border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => setPending({ type: "role", user: u, role: "user" })}
                >
                  <ArrowDownCircle className="size-3.5" />
                  Demote
                </Button>
              )}
              {canViewArticles(u) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                  onClick={() => onUserClick?.(u.id)}
                >
                  Articles
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [currentUser, onUserClick],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: users,
    pageCount: Math.ceil((users.length || 0) / pagination.pageSize),
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const confirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      if (pending.type === "status") {
        await onToggleActive?.(pending.user.id, pending.user.is_active !== 1);
      } else {
        await onRoleChange?.(pending.user.id, pending.role);
      }
      setPending(null);
    } finally {
      setSubmitting(false);
    }
  };

  const statusUser = pending?.type === "status" ? pending.user : null;
  const rolePending = pending?.type === "role" ? pending : null;
  const statusActive = statusUser?.is_active === 1;

  return (
    <>
      <DataGrid
        table={table}
        recordCount={users.length}
        isLoading={loading}
        loadingMode="skeleton"
        tableLayout={contiqTableLayout}
        tableClassNames={contiqTableClassNames}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer className={contiqTableContainerClassName}>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
          <DataGridPagination />
        </div>
      </DataGrid>

      <Dialog
        open={pending?.type === "status"}
        onOpenChange={(open) => !open && !submitting && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{statusActive ? "Deactivate" : "Activate"} user?</DialogTitle>
            <DialogDescription>
              {statusActive
                ? "They'll immediately lose access and won't be able to sign in until reactivated."
                : "They'll regain access and be able to sign in again."}
            </DialogDescription>
          </DialogHeader>
          {statusUser?.auth_role === "super_admin" && (
            <div className="flex items-start gap-2 rounded-sm bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              This is a super admin account. Make sure this action is intended.
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              disabled={submitting}
              variant={statusActive ? "destructive" : "default"}
              className={!statusActive ? "bg-emerald-600 hover:bg-emerald-700" : undefined}
              onClick={confirm}
            >
              {submitting ? "Please wait..." : statusActive ? "Deactivate" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pending?.type === "role"}
        onOpenChange={(open) => !open && !submitting && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change {rolePending?.user.name}'s role to{" "}
              {rolePending ? ROLE_LABELS[rolePending.role] : ""}?
            </DialogTitle>
            <DialogDescription>
              {rolePending?.role === "user"
                ? "They'll lose admin access to users, article types, and prompts."
                : "They'll gain access to manage articles, article types, and prompts."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={submitting} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button disabled={submitting} onClick={confirm}>
              {submitting ? "Please wait..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
