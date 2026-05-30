"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface AdminAutomation {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_active: boolean;
  execution_count: number;
  last_executed_at: string | null;
  created_at: string;
  owner_name?: string;
}

export default function AdminAutomationsPage() {
  const [automations, setAutomations] = useState<AdminAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const db = createClient();

    const { data, error } = await db
      .from("automations")
      .select(
        "id, user_id, name, description, trigger_type, is_active, execution_count, last_executed_at, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/automations]", error);
      toast.error("Failed to load automations list");
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data ?? []).map((a) => a.user_id))];
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

    setAutomations(
      (data ?? []).map((a) => ({
        ...a,
        owner_name: profileMap[a.user_id] ?? "Unknown",
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveAsTemplate = async (a: AdminAutomation) => {
    const desc = prompt(
      `Enter a description for the global template "${a.name}":`,
      a.description || "Pre-built custom workflow template defined by administrator.",
    );

    if (desc === null) return; // User cancelled

    setPublishingId(a.id);
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automationId: a.id,
          description: desc.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}`);
      }

      toast.success(`Successfully published "${a.name}" as a global template!`);
    } catch (err) {
      console.error("[admin/automations] publish template failed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to publish template");
    } finally {
      setPublishingId(null);
    }
  };

  const triggerLabel: Record<string, string> = {
    new_message_received: "New Message",
    first_inbound_message: "First Inbound",
    keyword_match: "Keyword Match",
    new_contact_created: "New Contact",
    conversation_assigned: "Assigned",
    tag_added: "Tag Added",
    time_based: "Scheduled",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Automations</h1>
        <p className="mt-1 text-sm text-slate-400">
          Automation workflows across all accounts. Administrators can publish any user's workflow as a template for everyone to use.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-400">Name</th>
              <th className="px-4 py-3 font-medium text-slate-400">Trigger</th>
              <th className="px-4 py-3 font-medium text-slate-400">Status</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 sm:table-cell">
                Executions
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Owner</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Last Run
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              : automations.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{a.name}</p>
                      {a.description && (
                        <p className="max-w-xs truncate text-xs text-slate-500">
                          {a.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                        {triggerLabel[a.trigger_type] ?? a.trigger_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.is_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-700/50 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                          Paused
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-300 sm:table-cell">
                      {a.execution_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                        {a.owner_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 md:table-cell">
                      {a.last_executed_at
                        ? new Date(a.last_executed_at).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => saveAsTemplate(a)}
                        disabled={publishingId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50 transition-all border border-amber-500/20"
                        title="Make this a global template for all users"
                      >
                        {publishingId === a.id ? (
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                        ) : (
                          <Sparkles className="h-3 w-3" />
                        )}
                        Save as Template
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && automations.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No automations found.
          </div>
        )}
      </div>
    </div>
  );
}
