"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AdminContact {
  id: string;
  user_id: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  created_at: string;
  owner_name?: string;
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const db = createClient();

      // Fetch all contacts
      const { data: contactsData, error } = await db
        .from("contacts")
        .select("id, user_id, phone, name, email, company, created_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[admin/contacts]", error);
        toast.error("Failed to load contacts");
        setLoading(false);
        return;
      }

      // Fetch profiles to map user_id -> full_name
      const userIds = [...new Set((contactsData ?? []).map((c) => c.user_id))];
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

      setContacts(
        (contactsData ?? []).map((c) => ({
          ...c,
          owner_name: profileMap[c.user_id] ?? "Unknown",
        })),
      );
      setLoading(false);
    };

    load();
  }, []);

  const deleteContact = async (contact: AdminContact) => {
    if (
      !confirm(
        `Delete contact "${contact.name || contact.phone}"? This will also remove their conversations and deals.`,
      )
    ) {
      return;
    }

    const db = createClient();
    const { error } = await db.from("contacts").delete().eq("id", contact.id);

    if (error) {
      toast.error("Failed to delete contact");
      return;
    }

    toast.success("Contact deleted");
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Contacts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Contacts from all user accounts. Showing up to 200 most recent.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-400">Name</th>
              <th className="px-4 py-3 font-medium text-slate-400">Phone</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 sm:table-cell">
                Email
              </th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Company
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Owner</th>
              <th className="hidden px-4 py-3 font-medium text-slate-400 md:table-cell">
                Created
              </th>
              <th className="px-4 py-3 font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              : contacts.map((c) => (
                  <tr
                    key={c.id}
                    className="transition-colors hover:bg-slate-900/50"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {c.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{c.phone}</td>
                    <td className="hidden px-4 py-3 text-slate-300 sm:table-cell">
                      {c.email || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-300 md:table-cell">
                      {c.company || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
                        {c.owner_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-400 md:table-cell">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => deleteContact(c)}
                        title="Delete contact"
                        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && contacts.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No contacts found across any account.
          </div>
        )}
      </div>
    </div>
  );
}
