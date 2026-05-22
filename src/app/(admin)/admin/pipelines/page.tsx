"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminPipeline {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  owner_name?: string;
  deal_count?: number;
}

export default function AdminPipelinesPage() {
  const [pipelines, setPipelines] = useState<AdminPipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = createClient();

      const { data, error } = await db
        .from("pipelines")
        .select("id, user_id, name, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[admin/pipelines]", error);
        setLoading(false);
        return;
      }

      const userIds = [...new Set((data ?? []).map((p) => p.user_id))];
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

      // Count deals per pipeline
      const pipelineIds = (data ?? []).map((p) => p.id);
      let dealCounts: Record<string, number> = {};
      if (pipelineIds.length > 0) {
        const { data: deals } = await db
          .from("deals")
          .select("pipeline_id")
          .in("pipeline_id", pipelineIds);
        (deals ?? []).forEach((d) => {
          dealCounts[d.pipeline_id] = (dealCounts[d.pipeline_id] ?? 0) + 1;
        });
      }

      setPipelines(
        (data ?? []).map((p) => ({
          ...p,
          owner_name: profileMap[p.user_id] ?? "Unknown",
          deal_count: dealCounts[p.id] ?? 0,
        })),
      );
      setLoading(false);
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Pipelines</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sales pipelines across all accounts.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-400">Pipeline</th>
              <th className="px-4 py-3 font-medium text-slate-400">Deals</th>
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
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              : pipelines.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-3 text-slate-300">{p.deal_count}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                        {p.owner_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && pipelines.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No pipelines found.
          </div>
        )}
      </div>
    </div>
  );
}
