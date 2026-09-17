"use client";

/* eslint-disable @next/next/no-img-element -- tanda tangan berupa data URL, bukan aset statis. */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { SignaturePad } from "@/components/leads/signature-pad";
import { inputClass } from "@/components/leads/illustration-person-form";
import { PERNYATAAN_ILUSTRASI } from "@/lib/illustration-data";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";

const STEP = "signature";

type Pihak = {
  key: "pp" | "tp";
  title: string;
  /** Hanya pemegang polis yang bisa dimintai tanda tangan lewat tautan. */
  tautan?: boolean;
};

const PIHAK: Pihak[] = [
  { key: "pp", title: "Tanda Tangan Pemegang Polis", tautan: true },
  { key: "tp", title: "Tanda Tangan Tenaga Pemasar" },
];

/** "2026-02-25T11:46:00.000Z" → "25 Februari 2026 | 11:46 WIB". */
function stempel(nilai: string): string {
  const waktu = new Date(nilai);
  if (Number.isNaN(waktu.getTime())) return nilai;

  const tanggal = waktu.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const jam = waktu.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return `${tanggal} | ${jam} WIB`;
}

/**
 * Langkah terakhir Sales Illustration: pernyataan dan tanda tangan.
 *
 * Tanda tangan digambar di kanvas lalu disimpan sebagai PNG data URL pada
 * `lead_illustration_fields`, bersama kota dan waktu penandatanganan.
 */
export function IllustrationSignature({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [menandatangani, setMenandatangani] = useState<Pihak | null>(null);
  const [tersimpan, setTersimpan] = useState(false);

  const detailHref = `/leads/details/${leadId}`;
  const backHref = `${detailHref}/sales-illustration/riplay`;

  const load = useCallback(async () => {
    try {
      setValues(await loadStep(leadId, STEP));
      setState("ready");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const value = (field: string) => values[field] ?? "";
  const setuju = value("persetujuan") === "Ya";

  async function simpan(fields: Record<string, string>) {
    setValues((prev) => ({ ...prev, ...fields }));
    setError("");
    setTersimpan(false);

    try {
      await saveStep(leadId, STEP, fields, agentName);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan ke database lokal.");
    }
  }

  function simpanTandaTangan(pihak: Pihak, dataUrl: string) {
    setMenandatangani(null);
    void simpan({
      [`${pihak.key}_tanda_tangan`]: dataUrl,
      [`${pihak.key}_waktu`]: new Date().toISOString(),
    });
  }

  function hapusTandaTangan(pihak: Pihak) {
    void simpan({ [`${pihak.key}_tanda_tangan`]: "", [`${pihak.key}_waktu`]: "" });
  }

  async function selesai() {
    if (!setuju) {
      setError("Centang pernyataan persetujuan terlebih dahulu.");
      return;
    }

    const kurang = PIHAK.filter((pihak) => !value(`${pihak.key}_tanda_tangan`));
    if (kurang.length > 0) {
      setError(`Lengkapi ${kurang.map((pihak) => pihak.title.toLowerCase()).join(" dan ")}.`);
      return;
    }

    await simpan({ ...values, selesai_at: new Date().toISOString() });
    setTersimpan(true);
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
          <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
            <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
              <h2 className="text-lg font-bold text-pfi-heading">Pernyataan</h2>
            </header>

            <div className="flex flex-col gap-6 p-4 sm:p-6">
              <ol className="flex list-decimal flex-col gap-4 pl-5 text-base leading-relaxed text-pfi-heading">
                {PERNYATAAN_ILUSTRASI.map((butir) => (
                  <li key={butir} className="pl-1.5">
                    {butir}
                  </li>
                ))}
              </ol>

              <label className="flex cursor-pointer items-center gap-4 rounded-[10px] border border-pfi-hairline bg-pfi-tint-alt px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={setuju}
                  onChange={(event) =>
                    void simpan({ persetujuan: event.target.checked ? "Ya" : "" })
                  }
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-[6px] border-2 transition",
                    setuju ? "border-pfi-link bg-pfi-link text-white" : "border-pfi-line bg-white"
                  )}
                >
                  {setuju && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="text-base font-bold text-pfi-heading">Saya Menyetujui</span>
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
            <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
              <h2 className="text-lg font-bold text-pfi-heading">Tanda Tangan</h2>
            </header>

            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
              {PIHAK.map((pihak) => {
                const gambar = value(`${pihak.key}_tanda_tangan`);
                const waktu = value(`${pihak.key}_waktu`);

                return (
                  <article
                    key={pihak.key}
                    className="flex flex-col gap-4 rounded-[10px] border border-pfi-hairline p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-base font-bold text-pfi-heading">{pihak.title}</h3>

                      {pihak.tautan && (
                        // TODO: tautan tanda tangan jarak jauh menunggu endpoint.
                        <span
                          aria-disabled
                          title="Tautan tanda tangan jarak jauh belum tersedia"
                          className="flex items-center gap-2.5 text-sm font-medium text-pfi-subtle"
                        >
                          <Link2 className="size-5" aria-hidden />
                          Buat Tautan
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setMenandatangani(pihak)}
                      className="grid h-56 place-items-center rounded-[10px] bg-pfi-bg transition hover:bg-pfi-hairline"
                    >
                      {gambar ? (
                        <img
                          src={gambar}
                          alt={pihak.title}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-sm text-pfi-muted">
                          Klik untuk membubuhkan tanda tangan
                        </span>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-pfi-line pb-4">
                      <button
                        type="button"
                        onClick={() => setMenandatangani(pihak)}
                        className="flex items-center gap-2.5 rounded-[10px] border border-pfi-link bg-white px-4 py-2.5 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
                      >
                        <RefreshCw className="size-5" aria-hidden />
                        {gambar ? "Perbarui" : "Tanda Tangan"}
                      </button>

                      <button
                        type="button"
                        onClick={() => hapusTandaTangan(pihak)}
                        disabled={!gambar}
                        className="flex items-center gap-2.5 rounded-[10px] border border-pfi-down-fg bg-white px-4 py-2.5 text-sm font-medium text-pfi-down-fg transition hover:bg-pfi-down-bg disabled:cursor-not-allowed disabled:border-pfi-line disabled:text-pfi-subtle disabled:hover:bg-white"
                      >
                        <Trash2 className="size-5" aria-hidden />
                        Hapus
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <input
                        value={value(`${pihak.key}_kota`)}
                        placeholder="Kota"
                        aria-label={`Kota ${pihak.title.toLowerCase()}`}
                        onChange={(event) =>
                          setValues((prev) => ({
                            ...prev,
                            [`${pihak.key}_kota`]: event.target.value,
                          }))
                        }
                        onBlur={() =>
                          void simpan({ [`${pihak.key}_kota`]: value(`${pihak.key}_kota`) })
                        }
                        className={cn(inputClass, "w-auto min-w-[180px] flex-1")}
                      />

                      <p className="text-sm text-pfi-muted">
                        Tanggal : {waktu ? stempel(waktu) : "–"}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {error && (
            <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
              {error}
            </p>
          )}

          {tersimpan && (
            <p className="rounded-[10px] border border-pfi-up-fg/30 bg-pfi-up-bg px-4 py-3 text-sm font-medium text-pfi-up-fg">
              Ilustrasi tersimpan. Anda bisa kembali ke Detail Lead atau meninjau ulang langkah
              sebelumnya.
            </p>
          )}
        </>
      )}

      <FnaFooter
        backHref={backHref}
        onNext={() => void selesai()}
        nextLabel={tersimpan ? "Tersimpan" : "Simpan"}
      />

      {tersimpan && (
        <button
          type="button"
          onClick={() => router.push(detailHref)}
          className="mx-auto text-sm font-bold text-pfi-link hover:underline"
        >
          Kembali ke Detail Lead
        </button>
      )}

      {menandatangani && (
        <SignaturePad
          title={menandatangani.title}
          onSave={(dataUrl) => simpanTandaTangan(menandatangani, dataUrl)}
          onClose={() => setMenandatangani(null)}
        />
      )}
    </div>
  );
}
