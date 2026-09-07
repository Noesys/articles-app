import { useState } from "react";
import {
  Mail,
  Briefcase,
  ShieldCheck,
  UserX,
  UserCheck,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthRole, User } from "@/admin/utils/types";

type UserCardProps = {
  user: User;
  submissionStatus?: "submitted" | "not_submitted";
  onToggleActive?: (
    userId: string,
    nextIsActive: boolean,
  ) => void | Promise<void>;
  onRoleChange?: (userId: string, nextRole: AuthRole) => void | Promise<void>;
  onUserClick?: (userId: string) => void;
};

const ROLE_STYLES: Record<AuthRole, string> = {
  super_admin: "bg-purple-50 text-purple-700",
  admin: "bg-indigo-50 text-indigo-700",
  user: "bg-slate-100 text-slate-600",
};

const ROLE_LABELS: Record<AuthRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function UserCard({
  user,
  submissionStatus,
  onToggleActive,
  onRoleChange,
  onUserClick,
}: UserCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [pendingRole, setPendingRole] = useState<AuthRole | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isActive = user.is_active === 1;
  const { user: currentUser } = useAuth();

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onToggleActive?.(user.id, !isActive);
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const openRoleChange = (role: AuthRole) => {
    setPendingRole(role);
    setRoleModalOpen(true);
  };

  const handleRoleConfirm = async () => {
    if (!pendingRole) return;
    setSubmitting(true);
    try {
      await onRoleChange?.(user.id, pendingRole);
      setRoleModalOpen(false);
      setPendingRole(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-4 hover:border-slate-300 transition-colors">
        {/* Avatar */}
        <div
          className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold
          ${isActive ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}
        >
          {getInitials(user.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">
              {user.name}
            </h3>
            <span
              className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${ROLE_STYLES[user.auth_role]}`}
            >
              {ROLE_LABELS[user.auth_role]}
            </span>
            <span
              className={`text-[11px] font-medium rounded-full px-2 py-0.5 flex items-center gap-1
              ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`}
              />
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="mt-2 space-y-1 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Mail size={13} className="text-slate-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            {user.job_role && (
              <div className="flex items-center gap-1.5">
                <Briefcase size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{user.job_role}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {currentUser?.id !== user.id && (
            <button
              onClick={() => setModalOpen(true)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors
              ${isActive ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
            >
              {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
              {isActive ? "Deactivate" : "Activate"}
            </button>
          )}

          {/* promote/demote, hidden entirely for super_admin */}
          {user.auth_role === "user" && (
            <button
              onClick={() => openRoleChange("admin")}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
            >
              <ArrowUpCircle size={14} />
              Promote to Admin
            </button>
          )}

          {user.auth_role === "user" && (
            <button
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg"
              onClick={() => onUserClick?.(user.id)}
            >
              View user articles
            </button>
          )}

          {user.auth_role === "admin" && (
            <>
              <button
                onClick={() => openRoleChange("user")}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ArrowDownCircle size={14} />
                Demote to User
              </button>
            </>
          )}
          {/* super_admin: no promote/demote buttons at all — can't be demoted, nothing higher to promote to */}
        </div>
      </div>

      {/* Confirmation modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => !submitting && setModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-start justify-between">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center
                ${isActive ? "bg-red-50" : "bg-emerald-50"}`}
              >
                {isActive ? (
                  <UserX size={18} className="text-red-600" />
                ) : (
                  <UserCheck size={18} className="text-emerald-700" />
                )}
              </div>
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <h2 className="mt-3 font-semibold text-slate-900">
              {/* {isActive ? "Deactivate" : "Activate"} {user.name}? */}
              {isActive && currentUser && user.email !== currentUser.email
                ? "Deactivate"
                : "Activate"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isActive
                ? "They'll immediately lose access and won't be able to sign in until reactivated."
                : "They'll regain access and be able to sign in again."}
            </p>

            {user.auth_role === "super_admin" && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-purple-50 px-3 py-2 text-xs text-purple-700">
                <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                This is a super admin account. Make sure this action is
                intended.
              </div>
            )}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50
                  ${isActive ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                {submitting
                  ? "Please wait..."
                  : isActive
                    ? "Deactivate"
                    : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleModalOpen && pendingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => !submitting && setRoleModalOpen(false)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <ShieldCheck size={18} className="text-indigo-600" />
            </div>
            <h2 className="mt-3 font-semibold text-slate-900">
              Change {user.name}'s role to {ROLE_LABELS[pendingRole]}?
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {pendingRole === "super_admin"
                ? "This grants full administrative access, including managing other admins."
                : pendingRole === "user"
                  ? "They'll lose admin access to users, article types, and prompts."
                  : "They'll gain access to manage articles, article types, and prompts."}
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setRoleModalOpen(false)}
                disabled={submitting}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleConfirm}
                disabled={submitting}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "Please wait..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
