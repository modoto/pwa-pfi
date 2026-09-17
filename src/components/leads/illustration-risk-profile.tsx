"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { FnaQuestionList } from "@/components/leads/fna-question-list";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { MasterMissing } from "@/components/master-missing";
import { produkTradisional } from "@/lib/illustration-data";
import { RISK_PROFILE_KEY } from "@/lib/fna-questions";
import { toFnaQuestions } from "@/lib/risk-profile-score";
import { listAnswers, setAnswer } from "@/lib/db/fna-repo";
import { loadStep } from "@/lib/db/illustration-repo";
import { listRpqQuestions, type MasterRpqQuestion } from "@/lib/db/master-repo";

const STEP = "risk-profile";

/**
 * Langkah keempat Sales Illustration: Kuesioner Profil Resiko.
 *
 * Pertanyaan dan jawabannya sama dengan kuesioner di FnA — dibaca dan ditulis
 * langsung ke `lead_fna_answers` topik `profil-risiko`, tanpa tabel baru.
 * Mengubah jawaban di sini juga mengubah hasil analisa profil risiko di FnA;
 * itu memang disepakati sebagai satu sumber data.
 */
export function IllustrationRiskProfile({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  // `null` = master RPQ belum pernah ditarik ke perangkat.
  const [master, setMaster] = useState<MasterRpqQuestion[] | null>([]);

  const questions = toFnaQuestions(master ?? []);
  const detailHref = `/leads/details/${leadId}`;
  const backHref = `${detailHref}/sales-illustration/rider`;

  const load = useCallback(async () => {
    try {
      const [saved, pertanyaan, product] = await Promise.all([
        listAnswers(leadId, RISK_PROFILE_KEY),
        listRpqQuestions(),
        loadStep(leadId, "product"),
      ]);

      // Langkah ini hanya untuk unit link; produk tradisional langsung ke
      // Kutipan Ilustrasi (mis. bila URL-nya dibuka langsung).
      if (produkTradisional(product.jenis_produk)) {
        router.replace(`${detailHref}/sales-illustration/quotation`);
        return;
      }
      setMaster(pertanyaan);
      setAnswers(Object.fromEntries(saved.map((row) => [row.pertanyaan, row.jawaban])));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId, detailHref, router]);

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

    router.push(`${detailHref}/sales-illustration/investment`);
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
      ) : master === null ? (
        <MasterMissing label="kuesioner profil risiko" />
      ) : (
        <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
          <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
            <h2 className="text-lg font-bold text-pfi-heading">Kuesioner Profil Resiko</h2>
          </header>

          <div className="p-4 sm:p-6">
            <FnaQuestionList
              bare
              questions={questions}
              answers={answers}
              showErrors={showErrors}
              onPick={(questionKey, option) => void pick(questionKey, option)}
            />
          </div>
        </section>
      )}

      <FnaFooter backHref={backHref} onNext={goNext} />
    </div>
  );
}
