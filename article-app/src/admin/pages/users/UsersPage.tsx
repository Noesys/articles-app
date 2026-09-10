import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";

import UsersTable from "@/admin/components/users/UsersTable";
import { Button } from "@/components/ui/button";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/reui/autocomplete";
import { User } from "@/admin/utils/types";
import { api } from "@/http-client";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { InlineAlert } from "@/components/ui/inline-alert";

async function fetchUsers(month?: string, submissionStatus?: "not_submitted"): Promise<User[]> {
  const params = new URLSearchParams();
  if (month && submissionStatus) {
    params.set("month", month);
    params.set("submission_status", submissionStatus);
  }
  const qs = params.toString();
  return api<User[]>(`/admin/users${qs ? `?${qs}` : ""}`);
}

const ROLE_ORDER = {
  super_admin: 0,
  admin: 1,
  user: 2,
} as const;

const UsersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthParam = searchParams.get("month");
  const selectedMonthKey =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) && dayjs(`${monthParam}-01`).isValid()
      ? monthParam
      : dayjs().format("YYYY-MM");

  const navigate = useNavigate();
  const search = searchParams.get("q") || "";
  const showNotSubmitted = searchParams.get("status") === "not_submitted";
  const setFilterParam = (name: string, value: string, defaultValue?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(name);
      else next.set(name, value);
      return next;
    });
  };

  const handleToggleNotSubmitted = () => {
    setFilterParam("status", showNotSubmitted ? "" : "not_submitted");
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchUsers(
      showNotSubmitted && selectedMonthKey ? selectedMonthKey : undefined,
      showNotSubmitted ? "not_submitted" : undefined,
    )
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [showNotSubmitted, selectedMonthKey]);

  const handleToggleActive = async (userId: string, nextIsActive: boolean) => {
    await api(`/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: nextIsActive }),
    });

    setUsers((prev) =>
      nextIsActive
        ? prev.map((u) => (u.id === userId ? { ...u, is_active: 1 } : u))
        : prev.filter((u) => u.id !== userId),
    );
  };

  const handleRoleChange = async (userId: string, nextRole: "user" | "admin" | "super_admin") => {
    await api(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: nextRole }),
    });

    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, auth_role: nextRole } : u)));
  };

  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => u.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => {
        const roleDiff = ROLE_ORDER[a.auth_role] - ROLE_ORDER[b.auth_role];
        if (roleDiff !== 0) return roleDiff;
        return a.name.localeCompare(b.name);
      });
  }, [users, search]);

  const searchItems = useMemo(
    () =>
      users.map((u) => ({
        id: u.id,
        value: u.name,
      })),
    [users],
  );

  return (
    <PageShell>
      <PageHeader
        title="Users"
        subtitle={
          loading
            ? "Loading…"
            : `${filteredUsers.length} ${filteredUsers.length === 1 ? "user" : "users"}`
        }
      />
      <FilterToolbar>
        <div className="relative min-w-[200px] flex-1">
          <Autocomplete
            items={searchItems}
            value={search}
            onValueChange={(value) => setFilterParam("q", value ?? "")}
            itemToStringValue={(item) => (typeof item === "string" ? item : item.value)}
          >
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-slate-400"
              />
              <AutocompleteInput
                placeholder="Search users..."
                size="lg"
                className="rounded-sm border-border bg-white pl-9"
                showClear
                aria-label="Search users"
              />
            </div>
            <AutocompleteContent>
              <AutocompleteEmpty>No users found.</AutocompleteEmpty>
              <AutocompleteList>
                {(item) => (
                  <AutocompleteItem key={item.id} value={item}>
                    {item.value}
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </AutocompleteContent>
          </Autocomplete>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleToggleNotSubmitted}
          aria-pressed={showNotSubmitted}
          className={
            showNotSubmitted
              ? "h-9 shrink-0 whitespace-nowrap border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              : "h-9 shrink-0 whitespace-nowrap border-border bg-white text-slate-600"
          }
        >
          Show not submitted
        </Button>
        {showNotSubmitted && (
          <>
            <span className="self-center text-sm font-medium whitespace-nowrap text-slate-700">
              Filter by month
            </span>
            <MonthYearPicker
              label="Month"
              value={selectedMonthKey}
              onChange={(ym) => setFilterParam("month", ym)}
            />
          </>
        )}
      </FilterToolbar>

      {error && <InlineAlert>{error}</InlineAlert>}

      {!error && (
        <UsersTable
          users={filteredUsers}
          loading={loading}
          onToggleActive={handleToggleActive}
          onUserClick={(id) => navigate(`/admin/${id}/articles`)}
          onRoleChange={handleRoleChange}
        />
      )}
    </PageShell>
  );
};

export default UsersPage;
