"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FnaBanner, FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { FnaQuestionList } from "@/components/leads/fna-question-list";
import { MasterMissing } from "@/components/master-missing";
import { RISK_PROFILE_KEY } from "@/lib/fna-questions";
import { toFnaQuestions } from "@/lib/risk-profile-score";
import { listAnswers, listPriorities, setAnswer } from "@/lib/db/fna-repo";
import { listRpqQuestions, type MasterRpqQuestion } from "@/lib/db/master-repo";

/**
 * Kuesioner Profil Risiko — langkah sesudah seluruh prioritas selesai.
 *
 * Pertanyaan, pilihan jawaban, dan bobot skornya berasal dari master RPQ lokal
 * (`rpq_config_questions` + `rpq_config_answers`), bukan daftar di kode —
 * supaya skornya benar-benar bisa dijumlahkan. Jawabannya disimpan di
 * `lead_fna_answers` dengan `topik` = RISK_PROFILE_KEY dan `pertanyaan` =
 * kode pertanyaan RPQ (Q1, Q2, …).
 */
export function FnaRiskProfile({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [backHref, setBackHref] = useState(`/leads/details/${leadId}/fna/priorities`);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  // `null` = master RPQ belum pernah ditarik ke perangkat.
  const [master, setMaster] = useState<MasterRpqQuestion[] | null>([]);

  const questions = toFnaQuestions(master ?? []);
  const detailHref = `/leads/details/${leadId}`;
  const nextHref = `${detailHref}/fna/risk-result`;

  const load = useCallback(async () => {
    try {
      const [rows, saved, pertanyaan] = await Promise.all([
        listPriorities(leadId),
        listAnswers(leadId, RISK_PROFILE_KEY),
        listRpqQuestions(),
      ]);
      setMaster(pertanyaan);

      // Kembali ke ringkasan prioritas terakhir, langkah tepat sebelum ini.
      const last = rows[rows.length - 1];
      if (last) setBackHref(`${detailHref}/fna/summary/${last.topik}`);

      setAnswers(Object.fromEntries(saved.map((row) => [row.pertanyaan, row.jawaban])));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId, detailHref]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const missing = questions.filter((question) => !answers[question.key]);

  async function pick(questionKey: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionKey]: option }));

    try {
      await setAnswer(leadId, RISK_PROFILE_KEY, questionKey, option, agentName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.");
      setState("error");
    }
  }

  function goNext() {
    if (missing.length > 0) {
      setShowErrors(true);
      document
        .getElementById(`pertanyaan-${missing[0].key}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    router.push(nextHref);
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={backHref} />
      <FnaBanner>Kuesioner Profil Risiko</FnaBanner>

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : master === null ? (
        <MasterMissing label="kuesioner profil risiko" />
      ) : (
        <FnaQuestionList
          questions={questions}
          answers={answers}
          showErrors={showErrors}
          onPick={(questionKey, option) => void pick(questionKey, option)}
        />
      )}

      <FnaFooter backHref={backHref} onNext={goNext} />
    </div>
  );
}
