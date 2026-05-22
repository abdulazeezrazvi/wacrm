"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminBroadcast {
  id: string;
  user_id: string;
  name: string;
  template_name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  created_at: string;
  owner_name?: string;
}

export default function AdminBroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<AdminBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = createClient();

      const { data, error } = await db
        .from("broadcasts")
        .select(
          "id, user_id, name, template_name, status, total_recipients, sent_count, delivered_count, read_count, failed_count, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[admin/broadcasts]", error);
        setLoading(false);
        return;
      }

      const userIds = [...new Set((data ?? []).map((b) => b.user_id))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await db
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        profileMap = (profiles ?? []).reduce(
          (acc, p) => {
            acc[p.user_id] = p.full_name || "Unknown";
            return acc;
          },
          {} as Record<string, string>,
        );
      }

      setBroadcasts(
        (data ?? []).map((b) => ({
          ...b,
          owner_name: profileMap[b.user_id] ?? "Unknown",
        })),
      );
      setLoading(false);
    };

    load();
  }, []);

  const statusColor: Record<string, string> = {
    draft: "bg-slate-700/50 text-slate-400",
    scheduled: "bg-blue-500/10 text-blue-400",
    sending: "bg-amber-500/10 text-amber-400",
    sent: "bg-emerald-500/10 text-emerald-400",
    failed: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Broadcasts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Broadcast campaigns across all accounts.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-400">Name</th>
              <th className="px-4 py-3 font-medium text-slate-400">Status</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 sm:table-cell">
                Recipients
              </th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Delivered
              </th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Read
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Owner</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 sm:table-cell">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-20 rounded bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              : broadcasts.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{b.name}</p>
                      <p className="text-xs text-slate-500">{b.template_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[b.status] ?? statusColor.draft}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-300 sm:table-cell">
                      {b.total_recipients}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-300 md:table-cell">
                      {b.delivered_count}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-300 md:table-cell">
                      {b.read_count}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                        {b.owner_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                      {new Date(b.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && broadcasts.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No broadcasts found.
          </div>
        )}
      </div>
    </div>
  );
}
