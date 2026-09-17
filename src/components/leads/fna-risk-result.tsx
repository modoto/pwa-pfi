"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FnaBanner, FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { RISK_PROFILE_KEY } from "@/lib/fna-questions";
import { profileCardTone } from "@/lib/risk-profile-color";
import { riskProfileView } from "@/lib/risk-profile-score";
import { listAnswers, setAnswer } from "@/lib/db/fna-repo";
import {
  listRiskProfiles,
  listRpqQuestions,
  type MasterRiskProfile,
  type MasterRpqQuestion,
} from "@/lib/db/master-repo";

/**
 * Pernyataan persetujuan disimpan sebagai satu jawaban pada langkah profil
 * risiko, bukan tabel sendiri — bentuknya sama: satu nilai milik satu lead.
 */
const PERSETUJUAN_KEY = "persetujuan-panduan";

const PERNYATAAN =
  "Saya Mengerti Penilaian Profil Risiko Nasabah Ini Hanyalah Panduan Dalam Penentuan " +
  "Rekomendasi Produk Dan Juga Penempatan Investasi Dan Risikonya";

/** Hasil Analisa Profil Risiko. */
export function FnaRiskResult({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  // Pertanyaan + bobot dan rentang profil dari master; `null` = belum ditarik.
  const [questions, setQuestions] = useState<MasterRpqQuestion[] | null>([]);
  const [profiles, setProfiles] = useState<MasterRiskProfile[] | null>([]);

  const detailHref = `/leads/details/${leadId}`;

  const load = useCallback(async () => {
    try {
      const [saved, pertanyaan, profil] = await Promise.all([
        listAnswers(leadId, RISK_PROFILE_KEY),
        listRpqQuestions(),
        listRiskProfiles(),
      ]);
      setQuestions(pertanyaan);
      setProfiles(profil);
      setAnswers(Object.fromEntries(saved.map((row) => [row.pertanyaan, row.jawaban])));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const { skor, skorMaksimal, terjawab, total, profil } = riskProfileView(
    answers,
    questions ?? [],
    profiles ?? []
  );
  const masterKurang = questions === null || profiles === null;
  // Warna kartu mengikuti `rpq_color` profil terpilih di master.
  const warna = profileCardTone(profil?.warna);
  const setuju = answers[PERSETUJUAN_KEY] === "Ya";

  async function toggle(checked: boolean) {
    const jawaban = checked ? "Ya" : "Tidak";
    setAnswers((prev) => ({ ...prev, [PERSETUJUAN_KEY]: jawaban }));

    try {
      await setAnswer(leadId, RISK_PROFILE_KEY, PERSETUJUAN_KEY, jawaban, agentName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={`${detailHref}/fna/risk-profile`} />
      <FnaBanner>Hasil Analisa Profil Risiko</FnaBanner>

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      <section className="rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card sm:p-6">
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
            {masterKurang ? (
              <>
                Jawaban kuesioner sudah tersimpan, tetapi master profil risiko belum ditarik ke
                perangkat ini sehingga skor dan profil investasi belum bisa dihitung.
              </>
            ) : profil ? (
              <>
                Berdasarkan kuesioner, skor profil risiko Anda adalah{" "}
                <strong className="font-bold">{skor}</strong> dari maksimal {skorMaksimal}. Artinya
                Anda termasuk dalam profil <strong className="font-bold">{profil.nama}</strong>{" "}
                (rentang {profil.skorDari}–{profil.skorSampai}).
              </>
            ) : (
              <>Kuesioner belum dijawab, jadi skor profil risiko belum bisa dihitung.</>
            )}
          </p>
        </div>

        {!masterKurang && (
          <div className="mt-4 flex flex-col gap-2 text-sm text-pfi-muted">
            <p>
              {terjawab} dari {total} pertanyaan terjawab.
            </p>
            {profil?.keterangan && <p>{profil.keterangan}</p>}
            {profil && profil.funds.length > 0 && (
              <p>
                Dana investasi untuk profil ini:{" "}
                <span className="font-medium text-pfi-heading">
                  {profil.funds.map((fund) => fund.fund_name).join(", ")}
                </span>
                .
              </p>
            )}
          </div>
        )}
      </section>

      <label className="flex cursor-pointer items-start gap-4 rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card">
        <input
          type="checkbox"
          checked={setuju}
          disabled={state === "loading"}
          onChange={(event) => void toggle(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-pfi-radio"
        />
        <span className="text-base italic text-pfi-heading">{PERNYATAAN}</span>
      </label>

      <FnaFooter
        backHref={`${detailHref}/fna/risk-profile`}
        nextHref={`${detailHref}/fna/products`}
      />
    </div>
  );
}
