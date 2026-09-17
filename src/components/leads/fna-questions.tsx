"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FnaBanner, FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { FnaQuestionList } from "@/components/leads/fna-question-list";
import { topicByKey } from "@/lib/fna-data";
import { questionsOf } from "@/lib/fna-questions";
import { listAnswers, listPriorities, setAnswer, type PriorityRow } from "@/lib/db/fna-repo";

/**
 * Kuesioner FnA untuk satu topik prioritas.
 *
 * Jawaban langsung disimpan begitu dipilih — sesuai sifat offline-first
 * aplikasi ini, tidak ada tombol simpan terpisah yang bisa terlewat.
 */
export function FnaQuestions({
  leadId,
  topicKey,
  agentName,
}: {
  leadId: string;
  topicKey: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const topic = topicByKey(topicKey);
  const questions = questionsOf(topicKey);
  const detailHref = `/leads/details/${leadId}`;

  const load = useCallback(async () => {
    try {
      const [rows, saved] = await Promise.all([
        listPriorities(leadId),
        listAnswers(leadId, topicKey),
      ]);

      setPriorities(rows);
      setAnswers(Object.fromEntries(saved.map((row) => [row.pertanyaan, row.jawaban])));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId, topicKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  // Mundur ke ringkasan prioritas sebelumnya, maju ke ringkasan topik ini.
  // Topik yang dibuka lewat URL tanpa ada di daftar prioritas jatuh ke halaman
  // prioritas.
  const index = priorities.findIndex((row) => row.topik === topicKey);
  const previous = index > 0 ? priorities[index - 1] : null;

  const backHref = previous
    ? `${detailHref}/fna/summary/${previous.topik}`
    : `${detailHref}/fna/priorities`;
  const nextHref = `${detailHref}/fna/summary/${topicKey}`;

  const missing = questions.filter((question) => !answers[question.key]);

  async function pick(questionKey: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionKey]: option }));

    try {
      await setAnswer(leadId, topicKey, questionKey, option, agentName);
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
      <FnaBanner>{topic?.title ?? "FnA"}</FnaBanner>

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : questions.length === 0 ? (
        <section className="rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
          <p className="text-base font-bold text-pfi-heading">Pertanyaan belum tersedia</p>
          <p className="mt-2 text-sm text-pfi-muted">
            Daftar pertanyaan untuk topik ini belum ada di desain.
          </p>
        </section>
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
