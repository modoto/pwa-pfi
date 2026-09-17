"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FnaBanner, FnaHeader } from "@/components/leads/fna-chrome";
import { FNA_TOPICS } from "@/lib/fna-data";
import { startProcess } from "@/lib/db/processes-repo";

/**
 * Halaman pembuka FnA (Financial Needs Analysis) — "Tahukah Anda?".
 *
 * Isinya statis; langkah berisi form analisis menyusul. Membuka halaman ini
 * menandai proses "analisis" mulai berjalan di `lead_processes`.
 */
export function FnaIntro({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  useEffect(() => {
    // Gagal menandai tidak boleh menghalangi agen membaca halamannya.
    void startProcess(leadId, "analisis", agentName).catch(() => {});
  }, [leadId, agentName]);

  const detailHref = `/leads/details/${leadId}`;

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={detailHref} />
      <FnaBanner>Tahukah Anda?</FnaBanner>

      <div className="grid gap-6 lg:grid-cols-2">
        {FNA_TOPICS.map(({ key, title, question, body, icon: Icon }) => (
          <section
            key={key}
            className="flex flex-col gap-4 rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card sm:p-6"
          >
            <span className="grid size-14 place-items-center rounded-[10px] bg-pfi-tint text-pfi-proses">
              <Icon className="size-7" aria-hidden />
            </span>
            <h2 className="text-xl font-bold uppercase text-pfi-heading">{title}</h2>
            <p className="text-base text-pfi-heading">{question}</p>
            <p className="text-base text-pfi-muted">{body}</p>
          </section>
        ))}
      </div>

      <Link
        href={`${detailHref}/fna/priorities`}
        className="rounded-[10px] bg-pfi-orange px-6 py-3.5 text-center text-base font-medium text-white transition hover:bg-pfi-orange-dark"
      >
        Selanjutnya
      </Link>
    </div>
  );
}
