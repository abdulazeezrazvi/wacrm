"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminConversation {
  id: string;
  user_id: string;
  status: string;
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  contact?: { name: string | null; phone: string } | null;
  owner_name?: string;
}

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = createClient();

      const { data, error } = await db
        .from("conversations")
        .select(
          "id, user_id, status, last_message_text, last_message_at, unread_count, created_at, contact:contacts(name, phone)",
        )
        .order("last_message_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[admin/conversations]", error);
        setLoading(false);
        return;
      }

      // Map user_id -> owner name
      const userIds = [...new Set((data ?? []).map((c) => c.user_id))];
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

      setConversations(
        (data ?? []).map((c) => ({
          ...c,
          contact: Array.isArray(c.contact) ? c.contact[0] : c.contact,
          owner_name: profileMap[c.user_id] ?? "Unknown",
        })),
      );
      setLoading(false);
    };

    load();
  }, []);

  const statusColor: Record<string, string> = {
    open: "bg-emerald-500/10 text-emerald-400",
    pending: "bg-amber-500/10 text-amber-400",
    closed: "bg-slate-700/50 text-slate-400",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Conversations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Conversations across all user accounts. Showing up to 200 most recent.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-400">Contact</th>
              <th className="px-4 py-3 font-medium text-slate-400">Status</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Last Message
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Unread</th>
              <th className="px-4 py-3 font-medium text-slate-400">Owner</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 sm:table-cell">
                Last Activity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              : conversations.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {c.contact?.name || "Unknown"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {c.contact?.phone || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[c.status] ?? statusColor.closed}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-slate-300 md:table-cell">
                      {c.last_message_text || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c.unread_count > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs font-bold text-white">
                          {c.unread_count}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                        {c.owner_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                      {c.last_message_at
                        ? new Date(c.last_message_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && conversations.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No conversations found.
          </div>
        )}
      </div>
    </div>
  );
}
