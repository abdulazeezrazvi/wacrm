"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  MessageSquare,
  UserPlus,
  GitBranch,
  Radio,
  Zap,
  Shield,
} from "lucide-react";

interface AdminMetrics {
  totalUsers: number;
  totalContacts: number;
  totalConversations: number;
  totalDeals: number;
  totalBroadcasts: number;
  totalAutomations: number;
}

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = createClient();

      const [
        { count: totalUsers },
        { count: totalContacts },
        { count: totalConversations },
        { count: totalDeals },
        { count: totalBroadcasts },
        { count: totalAutomations },
      ] = await Promise.all([
        db.from("profiles").select("*", { count: "exact", head: true }),
        db.from("contacts").select("*", { count: "exact", head: true }),
        db.from("conversations").select("*", { count: "exact", head: true }),
        db.from("deals").select("*", { count: "exact", head: true }),
        db.from("broadcasts").select("*", { count: "exact", head: true }),
        db.from("automations").select("*", { count: "exact", head: true }),
      ]);

      setMetrics({
        totalUsers: totalUsers ?? 0,
        totalContacts: totalContacts ?? 0,
        totalConversations: totalConversations ?? 0,
        totalDeals: totalDeals ?? 0,
        totalBroadcasts: totalBroadcasts ?? 0,
        totalAutomations: totalAutomations ?? 0,
      });
      setLoading(false);
    };

    load().catch((err) => {
      console.error("[admin] overview load failed:", err);
      setLoading(false);
    });
  }, []);

  const cards = metrics
    ? [
        { label: "Total Users", value: metrics.totalUsers, icon: Users, color: "text-blue-400 bg-blue-500/10" },
        { label: "Total Contacts", value: metrics.totalContacts, icon: UserPlus, color: "text-emerald-400 bg-emerald-500/10" },
        { label: "Conversations", value: metrics.totalConversations, icon: MessageSquare, color: "text-violet-400 bg-violet-500/10" },
        { label: "Deals", value: metrics.totalDeals, icon: GitBranch, color: "text-pink-400 bg-pink-500/10" },
        { label: "Broadcasts", value: metrics.totalBroadcasts, icon: Radio, color: "text-amber-400 bg-amber-500/10" },
        { label: "Automations", value: metrics.totalAutomations, icon: Zap, color: "text-cyan-400 bg-cyan-500/10" },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
            <p className="text-sm text-slate-400">
              Cross-account metrics and management
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="h-4 w-24 rounded bg-slate-800" />
                <div className="mt-3 h-8 w-16 rounded bg-slate-800" />
              </div>
            ))
          : cards.map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-400">
                    {card.label}
                  </p>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}
                  >
                    <card.icon className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-2 text-3xl font-bold text-white">
                  {card.value.toLocaleString()}
                </p>
              </div>
            ))}
      </div>

      {/* Quick info */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-300">
          <strong>Admin access:</strong> You can view and manage all data across
          every user account. Use the sidebar to navigate to specific sections.
        </p>
      </div>
    </div>
  );
}
