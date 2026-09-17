"use client";

import { useCallback, useEffect, useState } from "react";
import { FnaBanner, FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { topicByKey } from "@/lib/fna-data";
import { questionsOf } from "@/lib/fna-questions";
import { listAnswers, listPriorities, type PriorityRow } from "@/lib/db/fna-repo";

/**
 * Ringkasan jawaban satu topik prioritas.
 *
 * Urutan barisnya mengikuti daftar pertanyaan, bukan urutan penyimpanan,
 * supaya sama dengan halaman kuesionernya.
 */
export function FnaSummary({ leadId, topicKey }: { leadId: string; topicKey: string }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [priorities, setPriorities] = useState<PriorityRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

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

  const index = priorities.findIndex((row) => row.topik === topicKey);
  const next = index >= 0 ? priorities[index + 1] : null;

  const backHref = `${detailHref}/fna/questions/${topicKey}`;
  // Prioritas terakhir dilanjutkan ke Kuesioner Profil Risiko.
  const nextHref = next
    ? `${detailHref}/fna/questions/${next.topik}`
    : `${detailHref}/fna/risk-profile`;

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={backHref} />
      <FnaBanner>{topic?.title ?? "FnA"}</FnaBanner>

      {state === "error" && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : questions.length === 0 ? (
        <section className="rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
          <p className="text-base font-bold text-pfi-heading">Belum ada jawaban</p>
          <p className="mt-2 text-sm text-pfi-muted">
            Daftar pertanyaan untuk topik ini belum ada di desain.
          </p>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-[1024px] rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card sm:p-6">
          <dl className="flex flex-col">
            {questions.map((question) => (
              <div
                key={question.key}
                className="flex flex-col gap-2 border-b border-pfi-hairline py-4 first:pt-0 last:border-b-0 last:pb-0"
              >
                <dt className="text-base font-bold text-pfi-heading">{question.text}</dt>
                {/* Jawaban ditampilkan apa adanya seperti yang dipilih agen. */}
                <dd className="text-base text-pfi-muted">
                  {answers[question.key] ?? "Belum dijawab"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <FnaFooter backHref={backHref} nextHref={nextHref} />
    </div>
  );
}
