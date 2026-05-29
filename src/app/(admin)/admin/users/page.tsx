"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, Shield, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load users");
      setUsers(json.users ?? []);
    } catch (err) {
      console.error("[admin/users] load failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleRole = async (profile: UserProfile) => {
    const newRole = profile.role === "admin" ? "user" : "admin";
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: profile.id, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update role");

      toast.success(`${profile.full_name || profile.email} is now ${newRole}`);
      setUsers((prev) =>
        prev.map((u) => (u.id === profile.id ? { ...u, role: newRole } : u)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const deleteUser = async (profile: UserProfile) => {
    if (profile.role === "admin") {
      toast.error("Cannot delete an admin account from here");
      return;
    }
    if (!confirm(`Delete user "${profile.full_name || profile.email}"? This will remove all their data.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?userId=${profile.user_id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete user");

      toast.success("User deleted successfully!");
      setUsers((prev) => prev.filter((u) => u.id !== profile.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Users</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage all registered accounts. Promote users to admin or revoke
          access.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-400">User</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 sm:table-cell">
                Email
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Role</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Joined
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 rounded bg-slate-800" />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="h-4 w-40 rounded bg-slate-800" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-16 rounded bg-slate-800" />
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <div className="h-4 w-24 rounded bg-slate-800" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 rounded bg-slate-800" />
                    </td>
                  </tr>
                ))
              : users.map((u) => (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-sm font-medium text-violet-400">
                          {u.full_name?.charAt(0)?.toUpperCase() ??
                            u.email?.charAt(0)?.toUpperCase() ??
                            "U"}
                        </div>
                        <span className="font-medium text-white">
                          {u.full_name || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-300 sm:table-cell">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                          <Users className="h-3 w-3" /> User
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 md:table-cell">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRole(u)}
                          title={
                            u.role === "admin"
                              ? "Revoke admin"
                              : "Promote to admin"
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        {u.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => deleteUser(u)}
                            title="Delete user"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}
