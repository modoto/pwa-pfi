"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LeadForm } from "@/components/leads/lead-form";
import { getLead, type LeadRow } from "@/lib/db/leads-repo";

/**
 * Memuat lead dari database lokal lalu menyerahkannya ke `LeadForm`.
 *
 * Form baru dipasang setelah datanya ada, karena nilai awal setiap field
 * dibaca sekali saat komponen pertama kali dirender.
 */
export function LeadEditor({ leadId, channel = "" }: { leadId: string; channel?: string }) {
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const row = await getLead(leadId);
      if (!row) {
        setState("missing");
        return;
      }

      setLead(row);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuka database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  if (state === "loading") {
    return <p className="p-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>;
  }

  if (state === "error") {
    return <p className="p-10 text-center text-sm font-medium text-pfi-down-fg">{message}</p>;
  }

  if (state === "missing" || !lead) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-pfi-muted">Lead tidak ditemukan di database lokal.</p>
        <Link href="/leads" className="text-sm font-bold text-pfi-link hover:underline">
          Kembali ke Daftar Leads
        </Link>
      </div>
    );
  }

  return <LeadForm lead={lead} channel={channel} />;
}
