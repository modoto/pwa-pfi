"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { stepsUntukProduk } from "@/lib/illustration-data";
import { RISK_PROFILE_KEY } from "@/lib/fna-questions";
import { listAnswers } from "@/lib/db/fna-repo";
import { loadStep, stepsWithData } from "@/lib/db/illustration-repo";

/**
 * Stepper delapan langkah Sales Illustration.
 *
 * Langkah yang sudah dilewati bisa diklik supaya agen mudah memeriksa ulang
 * isian sebelumnya. Yang dianggap sudah dilewati: langkah mana pun sampai
 * langkah terjauh yang punya isian — termasuk langkah tanpa isian seperti
 * Kutipan Ilustrasi dan RIPLAY yang isinya hanya tampilan.
 *
 * Untuk produk tradisional, Kuesioner Profil Resiko dan Pilihan Investasi
 * tidak ditampilkan (lihat `stepsUntukProduk`).
 */
export function IllustrationStepper({
  current,
  leadId,
}: {
  current: string;
  leadId: string;
}) {
  const [terjauh, setTerjauh] = useState(-1);
  const [jenisProduk, setJenisProduk] = useState<string | undefined>(undefined);

  const langkah = stepsUntukProduk(jenisProduk);
  const activeIndex = langkah.findIndex((step) => step.slug === current);

  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const [terisiLangkah, jawaban, product] = await Promise.all([
          stepsWithData(leadId),
          listAnswers(leadId, RISK_PROFILE_KEY),
          loadStep(leadId, "product"),
        ]);
        if (batal) return;

        const terisi = new Set(terisiLangkah);
        if (jawaban.length > 0) terisi.add("risk-profile");

        const index = stepsUntukProduk(product.jenis_produk).reduce(
          (paling, step, i) => (terisi.has(step.slug) ? i : paling),
          -1
        );
        setJenisProduk(product.jenis_produk);
        setTerjauh(index);
      } catch {
        // Gagal membaca kemajuan tidak boleh mematikan halaman; stepper cukup
        // tampil tanpa tautan.
      }
    })();

    return () => {
      batal = true;
    };
  }, [leadId]);

  const batas = Math.max(terjauh, activeIndex);

  return (
    <div className="-mx-4 -mt-6 overflow-x-auto border-b border-pfi-hairline bg-white px-4 py-5 sm:-mx-6 sm:px-6">
      <ol className="flex min-w-[880px] items-start">
        {langkah.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const bisaDiklik = !active && index <= batas;

          const titik = (
            <>
              <div className="flex w-full items-center">
                <span
                  className={cn(
                    "h-0.5 flex-1",
                    index === 0 ? "bg-transparent" : done || active ? "bg-pfi-link" : "bg-pfi-line"
                  )}
                />
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full border-2",
                    active
                      ? "border-pfi-link bg-pfi-link"
                      : done || bisaDiklik
                        ? "border-pfi-link bg-white"
                        : "border-pfi-line bg-white"
                  )}
                >
                  {active && <span className="size-1.5 rounded-full bg-white" />}
                  {(done || bisaDiklik) && !active && (
                    <span className="size-2 rounded-full bg-pfi-link" />
                  )}
                </span>
                <span
                  className={cn(
                    "h-0.5 flex-1",
                    index === langkah.length - 1
                      ? "bg-transparent"
                      : done
                        ? "bg-pfi-link"
                        : "bg-pfi-line"
                  )}
                />
              </div>

              <span
                className={cn(
                  "px-1 text-center text-xs font-medium uppercase",
                  active
                    ? "text-pfi-heading"
                    : bisaDiklik
                      ? "text-pfi-link group-hover:underline"
                      : "text-pfi-subtle"
                )}
              >
                {step.label}
              </span>
            </>
          );

          return (
            <li key={step.slug} className="flex flex-1 flex-col items-center">
              {bisaDiklik ? (
                <Link
                  href={`/leads/details/${leadId}/sales-illustration/${step.slug}`}
                  className="group flex w-full flex-col items-center gap-2.5"
                >
                  {titik}
                </Link>
              ) : (
                <div
                  aria-current={active ? "step" : undefined}
                  className="flex w-full flex-col items-center gap-2.5"
                >
                  {titik}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
