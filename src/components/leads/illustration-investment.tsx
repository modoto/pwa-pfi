"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { FundModal } from "@/components/leads/fund-modal";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { MasterMissing } from "@/components/master-missing";
import { FUND_CODE_TO_WORKBOOK_INDEX, LEGACY_FUND_NAMES } from "@/lib/investment-data";
import { produkTradisional } from "@/lib/illustration-data";
import { RISK_PROFILE_KEY } from "@/lib/fna-questions";
import { profileCardTone } from "@/lib/risk-profile-color";
import { riskProfileView } from "@/lib/risk-profile-score";
import { listAnswers } from "@/lib/db/fna-repo";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";
import {
  listFunds,
  listRiskProfiles,
  listRpqQuestions,
  type MasterFund,
  type MasterRiskProfile,
  type MasterRpqQuestion,
} from "@/lib/db/master-repo";

const STEP = "investment";

/**
 * Satu baris alokasi dana. `code` = kode dana di master (mis. "MLEF") dan
 * menjadi kunci; `fund` = nama tampilannya.
 */
type Alokasi = { code: string; fund: string; persen: number };

/** Kode dana untuk alokasi lama yang tersimpan sebelum ada master dana. */
function kodeLama(nama: string): string | null {
  const index = LEGACY_FUND_NAMES.indexOf(nama as (typeof LEGACY_FUND_NAMES)[number]);
  if (index < 0) return null;
  return (
    Object.entries(FUND_CODE_TO_WORKBOOK_INDEX).find(([, urutan]) => urutan === index)?.[0] ?? null
  );
}

function parseAlokasi(raw: string): Alokasi[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return (parsed as Partial<Alokasi>[])
      .map((item) => {
        const fund = typeof item?.fund === "string" ? item.fund : "";
        const code = typeof item?.code === "string" ? item.code : kodeLama(fund);
        return code ? { code, fund: fund || code, persen: Number(item.persen) || 0 } : null;
      })
      .filter((item): item is Alokasi => item !== null);
  } catch {
    return [];
  }
}

/**
 * Langkah kelima Sales Illustration: Pilihan Investasi.
 *
 * Kartu skor memakai jawaban Kuesioner Profil Resiko yang sama dengan FnA;
 * rumus skornya belum ada (lihat src/lib/risk-profile-score.ts), jadi skor dan
 * nama profil masih ditampilkan sebagai strip.
 *
 * Alokasi dana disimpan sebagai satu field berisi JSON pada langkah ini dan
 * wajib berjumlah 100% — aturan yang sama dengan MSL.xlsm (`input!J9`).
 */
export function IllustrationInvestment({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [alokasi, setAlokasi] = useState<Alokasi[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [memilihFund, setMemilihFund] = useState(false);
  // `null` = master dana belum pernah ditarik ke database lokal.
  const [funds, setFunds] = useState<MasterFund[] | null>([]);
  // Pertanyaan RPQ (dengan bobot) dan rentang profil, juga dari master.
  const [questions, setQuestions] = useState<MasterRpqQuestion[] | null>([]);
  const [profiles, setProfiles] = useState<MasterRiskProfile[] | null>([]);

  const detailHref = `/leads/details/${leadId}`;
  const backHref = `${detailHref}/sales-illustration/risk-profile`;

  const load = useCallback(async () => {
    try {
      const [saved, jawaban, masterDana, pertanyaan, profil, product] = await Promise.all([
        loadStep(leadId, STEP),
        listAnswers(leadId, RISK_PROFILE_KEY),
        listFunds(),
        listRpqQuestions(),
        listRiskProfiles(),
        loadStep(leadId, "product"),
      ]);

      // Dana investasi hanya ada pada produk unit link.
      if (produkTradisional(product.jenis_produk)) {
        router.replace(`${detailHref}/sales-illustration/quotation`);
        return;
      }

      setFunds(masterDana);
      setQuestions(pertanyaan);
      setProfiles(profil);

      setAlokasi(parseAlokasi(saved.alokasi ?? ""));
      setAnswers(Object.fromEntries(jawaban.map((row) => [row.pertanyaan, row.jawaban] as const)));
      setState("ready");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId, detailHref, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const { skor, skorMaksimal, profil } = riskProfileView(answers, questions ?? [], profiles ?? []);
  const penjelasan = profil?.keterangan ?? null;
  // Dana yang dianjurkan untuk profil ini (`fund_mapping_funds`).
  const danaProfil = profil?.funds.map((fund) => fund.fund_code) ?? [];
  // Warna kartu mengikuti `rpq_color` profil terpilih di master.
  const warna = profileCardTone(profil?.warna);
  const total = alokasi.reduce((jumlah, item) => jumlah + item.persen, 0);

  async function simpan(next: Alokasi[]) {
    try {
      await saveStep(leadId, STEP, { alokasi: JSON.stringify(next) }, agentName);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan ke database lokal.");
    }
  }

  function ubahPersen(code: string, nilai: number) {
    const persen = Math.min(100, Math.max(0, Math.round(nilai) || 0));
    const next = alokasi.map((item) => (item.code === code ? { ...item, persen } : item));

    setAlokasi(next);
    setError("");
    void simpan(next);
  }

  /** Dana yang tetap dipilih mempertahankan porsinya; dana baru mulai dari 0%. */
  function simpanPilihanFund(codes: string[]) {
    const next = codes.map((code) => ({
      code,
      fund: funds?.find((master) => master.fund_code === code)?.fund_name ?? code,
      persen: alokasi.find((item) => item.code === code)?.persen ?? 0,
    }));

    setAlokasi(next);
    setError("");
    setMemilihFund(false);
    void simpan(next);
  }

  function goNext() {
    if (alokasi.length === 0) {
      setError("Pilih minimal satu dana investasi.");
      return;
    }
    if (total !== 100) {
      setError(`Jumlah alokasi harus 100%. Saat ini ${total}%.`);
      return;
    }

    router.push(`${detailHref}/sales-illustration/quotation`);
  }

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
        <>
          <section className="flex flex-col gap-5 rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card sm:p-6">
            <div
              style={warna.style}
              className={cn(
                "flex flex-col gap-5 rounded-[10px] p-6 transition-colors sm:flex-row sm:items-center sm:gap-8",
                warna.card
              )}
            >
              <div className="flex flex-col gap-3 sm:w-40">
                <p className={cn("text-base", warna.label)}>Skor Anda</p>
                <p className="text-2xl font-bold">{skor ?? "–"}</p>
              </div>

              <span aria-hidden className={cn("hidden w-px self-stretch sm:block", warna.divider)} />

              <div className="flex flex-col gap-3 sm:w-52">
                <p className={cn("text-base", warna.label)}>Profil Investasi</p>
                <p className="text-2xl font-bold">{profil?.nama ?? "Belum tersedia"}</p>
              </div>

              <span aria-hidden className={cn("hidden w-px self-stretch sm:block", warna.divider)} />

              <p className="flex-1 text-base leading-relaxed">
                {questions === null || profiles === null ? (
                  <>
                    Master profil risiko belum ditarik ke perangkat ini, jadi skor dan profil
                    investasi belum bisa dihitung.
                  </>
                ) : profil ? (
                  <>
                    Berdasarkan kuesioner, skor profil risiko Anda adalah{" "}
                    <strong className="font-bold">{skor}</strong> dari maksimal {skorMaksimal}.
                    Artinya Anda termasuk dalam profil{" "}
                    <strong className="font-bold">{profil.nama}</strong>.
                  </>
                ) : (
                  <>Kuesioner profil risiko belum dijawab, jadi skornya belum bisa dihitung.</>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-5 rounded-[10px] bg-pfi-tint-alt p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-6">
              <span className="grid size-20 shrink-0 place-items-center rounded-[10px] text-pfi-proses">
                <TrendingUp className="size-12" aria-hidden />
              </span>

              <span aria-hidden className="hidden w-px self-stretch bg-pfi-line sm:block" />

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="text-lg font-bold text-pfi-heading">
                  {profil?.nama ?? "Profil Investasi"}
                </p>
                <p className="text-base leading-relaxed text-pfi-heading">
                  {penjelasan ??
                    "Penjelasan profil investasi tampil setelah kuesioner profil risiko dijawab."}
                </p>
                {danaProfil.length > 0 && (
                  <p className="text-sm text-pfi-muted">
                    Dana yang dianjurkan untuk profil ini:{" "}
                    <span className="font-medium text-pfi-heading">
                      {profil?.funds.map((fund) => fund.fund_name).join(", ")}
                    </span>
                    .
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
            <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
              <h2 className="text-lg font-bold text-pfi-heading">Rincian Pilihan Dana Investasi</h2>
            </header>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
              {alokasi.length === 0 ? (
                <p className="py-6 text-center text-sm text-pfi-muted">
                  Belum ada dana dipilih. Tekan “Tambah Fund” untuk memilih.
                </p>
              ) : (
                alokasi.map((item) => (
                  <div key={item.code} className="flex flex-col gap-3">
                    <p className="text-base font-bold text-pfi-heading">{item.fund}</p>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={item.persen}
                        aria-label={`Alokasi ${item.fund}`}
                        onChange={(event) => ubahPersen(item.code, Number(event.target.value))}
                        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-pfi-line accent-pfi-link"
                      />

                      <div className="flex items-center gap-3">
                        <div className="flex w-40 items-center gap-2 rounded-[10px] border border-pfi-line px-3.5 py-3">
                          <input
                            inputMode="numeric"
                            value={String(item.persen)}
                            aria-label={`Persentase ${item.fund}`}
                            onChange={(event) =>
                              ubahPersen(item.code, Number(event.target.value.replace(/\D/g, "")))
                            }
                            className="w-full bg-transparent text-sm text-pfi-heading outline-none"
                          />
                          <span className="text-sm text-pfi-muted">%</span>
                        </div>

                        {/* TODO: berkas laporan kinerja investasi belum ada di repo. */}
                        <span
                          aria-disabled
                          title="Laporan kinerja investasi belum tersedia"
                          className="flex items-center gap-3 rounded-[10px] bg-pfi-bg px-4 py-3 text-sm font-medium uppercase text-pfi-heading"
                        >
                          <FileText className="size-5 shrink-0 text-pfi-orange" aria-hidden />
                          Laporan Kinerja Investasi
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-4">
                  <p className="text-base font-bold text-pfi-link">Jumlah Alokasi (%)</p>
                  <p
                    className={cn(
                      "w-28 rounded-[10px] border px-3.5 py-3 text-center text-base",
                      total === 100
                        ? "border-pfi-line text-pfi-heading"
                        : "border-pfi-down-fg text-pfi-down-fg"
                    )}
                  >
                    {total}
                  </p>
                </div>
                {error && <p className="text-xs font-medium text-pfi-down-fg">{error}</p>}
              </div>

              {funds === null ? (
                <MasterMissing label="dana investasi" />
              ) : (
                <button
                  type="button"
                  onClick={() => setMemilihFund(true)}
                  className="mx-auto flex items-center gap-2.5 rounded-[10px] border border-pfi-link bg-white px-5 py-3 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
                >
                  <Plus className="size-5" aria-hidden />
                  Tambah Fund
                </button>
              )}
            </div>
          </section>
        </>
      )}

      <FnaFooter backHref={backHref} onNext={goNext} />

      {memilihFund && (
        <FundModal
          funds={funds ?? []}
          selected={alokasi.map((item) => item.code)}
          onSave={simpanPilihanFund}
          onClose={() => setMemilihFund(false)}
        />
      )}
    </div>
  );
}
