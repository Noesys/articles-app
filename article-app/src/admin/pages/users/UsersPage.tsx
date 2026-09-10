import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

import UsersTable from "@/admin/components/users/UsersTable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const selectedMonth: Dayjs = dayjs(`${selectedMonthKey}-01`).startOf("month");
  const focusedYear = Number(searchParams.get("year")) || selectedMonth.year();

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
      showNotSubmitted && selectedMonth ? selectedMonthKey : undefined,
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
    <div className="w-full px-4 md:px-8 py-5">
      <h1 className="text-3xl font-semibold">Users List</h1>
      <div className="flex gap-3 my-6 items-center">
        <div className="flex-1 relative">
          <Autocomplete
            items={searchItems}
            value={search}
            onValueChange={(value) => setFilterParam("q", value ?? "")}
            itemToStringValue={(item) => (typeof item === "string" ? item : item.value)}
          >
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none"
              />
              <AutocompleteInput
                placeholder="Search users..."
                size="lg"
                className="pl-9 bg-white"
                showClear
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
        <button
          onClick={handleToggleNotSubmitted}
          className={`whitespace-nowrap h-9 flex shrink-0 items-center justify-center gap-1.5 rounded-lg border px-4 text-sm font-medium transition-colors ${showNotSubmitted ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}
        >
          Show Not Submitted
        </button>
      </div>
      <div className="flex gap-3 mb-6">
        {showNotSubmitted && (
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap self-center">
            Filter by month
          </span>
        )}

        {showNotSubmitted && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-between font-normal w-[180px] h-9 bg-white border border-slate-300 rounded-lg text-sm shadow-none"
              >
                {selectedMonth.format("MMMM YYYY")}
                <Calendar className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>

            <PopoverContent className="w-64 p-3">
              <div className="flex items-center justify-between mb-3">
                <Button
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
                  onClick={() => setFilterParam("year", String(focusedYear - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="font-bold text-sm">{focusedYear}</div>

                <Button
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
                  onClick={() => setFilterParam("year", String(focusedYear + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  const month = dayjs().year(focusedYear).month(i).startOf("month");
                  const isSelected = selectedMonth.format("YYYY-MM") === month.format("YYYY-MM");
                  const isCurrent = dayjs().format("YYYY-MM") === month.format("YYYY-MM");

                  return (
                    <Button
                      key={i}
                      variant={isSelected ? "default" : "ghost"}
                      onClick={() => setFilterParam("month", month.format("YYYY-MM"))}
                      className={`h-9 text-sm relative ${
                        isSelected ? "" : "hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {month.format("MMM")}
                      {isCurrent && (
                        <span className="absolute top-1 right-1 h-1 w-1 rounded-full bg-primary" />
                      )}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!error && (
        <UsersTable
          users={filteredUsers}
          loading={loading}
          onToggleActive={handleToggleActive}
          onUserClick={(id) => navigate(`/admin/${id}/articles`)}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
};

export default UsersPage;
