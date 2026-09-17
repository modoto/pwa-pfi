"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationProjection } from "@/components/leads/illustration-projection";
import { MameProjection } from "@/components/leads/mame-projection";
import { RopProjection } from "@/components/leads/rop-projection";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { langkahTetangga } from "@/lib/illustration-data";
import { ropProductOf } from "@/lib/calc/rop-engine";
import type { IllustrationSteps } from "@/lib/calc/msl-input";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";

const STEP = "quotation";
const PRODUCT_STEP = "product";

const angka = (nilai: string) => Number(nilai.replace(/\D/g, "")) || 0;
const rupiah = (nilai: number) => nilai.toLocaleString("id-ID");

/** Total nominal seluruh baris top up berkala. */
function totalBerkala(raw: string): number {
  if (!raw) return 0;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return 0;

    return parsed.reduce<number>(
      (jumlah, item) => jumlah + angka(String((item as { jumlah?: string })?.jumlah ?? "")),
      0
    );
  } catch {
    return 0;
  }
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-pfi-hairline p-5 last:border-b-0 sm:p-6 sm:[&:nth-last-child(-n+2)]:border-b-0">
      <p className="text-base text-pfi-heading">{label}</p>
      <p className="text-2xl font-bold text-pfi-heading">{value}</p>
    </div>
  );
}

/**
 * Langkah keenam Sales Illustration: Kutipan Ilustrasi.
 *
 * Ringkasan baca-saja dari langkah Rincian Produk. Nomor kutipan dibuat di
 * klien dan disimpan sekali — belum ada endpoint ilustrasi yang bisa memberi
 * nomor resmi (lihat docs/catatan-api.md), jadi nomor ini sementara.
 */
export function IllustrationQuotation({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [produk, setProduk] = useState<Record<string, string>>({});
  const [idKutipan, setIdKutipan] = useState("");
  const [steps, setSteps] = useState<IllustrationSteps | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const detailHref = `/leads/details/${leadId}`;
  // Produk tradisional tidak punya langkah Pilihan Investasi, jadi tombol
  // Kembali menuju Rider.
  const backHref = `${detailHref}/sales-illustration/${
    langkahTetangga("quotation", steps?.product.jenis_produk, -1) ?? "investment"
  }`;

  const load = useCallback(async () => {
    try {
      const [dataProduk, dataKutipan, policyHolder, rider, investment] = await Promise.all([
        loadStep(leadId, PRODUCT_STEP),
        loadStep(leadId, STEP),
        loadStep(leadId, "policy-holder"),
        loadStep(leadId, "rider"),
        loadStep(leadId, "investment"),
      ]);

      setProduk(dataProduk);
      setSteps({ policyHolder, product: dataProduk, rider, investment });

      const tersimpan = dataKutipan.id_kutipan;
      if (tersimpan) {
        setIdKutipan(tersimpan);
      } else {
        const baru = String(Math.floor(100000 + Math.random() * 900000));
        setIdKutipan(baru);
        await saveStep(leadId, STEP, { id_kutipan: baru }, agentName);
      }

      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId, agentName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const value = (field: string) => produk[field] ?? "";

  const totalPremi = angka(value("premi_dasar")) + totalBerkala(value("top_up_berkala"));
  const totalTunggal = angka(value("top_up_tunggal_jumlah"));
  const judul = [value("nama_produk") || "Produk belum dipilih", value("mata_uang")]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={backHref} title="Ilustrasi" />
      <IllustrationStepper current={STEP} leadId={leadId} />

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : (
        <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
          <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
            <h2 className="text-lg font-bold text-pfi-heading">Kutipan Ilustrasi</h2>
          </header>

          <div className="p-4 sm:p-6">
            <article className="overflow-hidden rounded-[10px] border border-pfi-hairline">
              {/* TODO: baru satu kutipan; tanda centang menandai yang dipakai. */}
              <div className="flex items-start justify-between gap-4 bg-pfi-proses p-5 text-white sm:p-6">
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm text-white/85">ID : {idKutipan}</p>
                  <p className="text-xl font-bold">{judul}</p>
                </div>
                <CircleCheck className="size-6 shrink-0" aria-label="Kutipan dipakai" />
              </div>

              <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-pfi-hairline">
                <Cell label="Total Premi dan Regular Top Up" value={rupiah(totalPremi)} />
                <Cell label="Total Top Up Tunggal" value={rupiah(totalTunggal)} />
                <Cell
                  label="Uang Pertanggungan"
                  value={rupiah(angka(value("uang_pertanggungan")))}
                />
                <Cell
                  label="Masa Pertanggungan"
                  value={value("masa_pertanggungan") || "–"}
                />
              </div>
            </article>
          </div>
        </section>
      )}

      {/* Unit link memakai proyeksi MAML/MSL; MAME punya tabel manfaat sendiri;
          produk tradisional lain belum punya kalkulator. */}
      {steps &&
        (/maksima edukasi/i.test(steps.product.nama_produk ?? "") ? (
          <MameProjection steps={steps} />
        ) : ropProductOf(steps.product.nama_produk) ? (
          <RopProjection
            steps={steps}
            product={ropProductOf(steps.product.nama_produk) ?? "msp"}
          />
        ) : steps.product.jenis_produk === "Tradisional" ? (
          <section className="rounded-[14px] border border-pfi-hairline bg-white p-6 text-center text-sm text-pfi-muted shadow-card">
            Produk tradisional tidak memakai proyeksi investasi. Tabel premi dan manfaat
            asuransinya ada di dokumen RIPLAY Personal pada langkah berikutnya.
          </section>
        ) : (
          <IllustrationProjection steps={steps} />
        ))}

      <FnaFooter
        backHref={backHref}
        onNext={() => router.push(`${detailHref}/sales-illustration/riplay`)}
      />
    </div>
  );
}
