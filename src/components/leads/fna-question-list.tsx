"use client";

import { cn } from "@/lib/utils";
import type { FnaQuestion } from "@/lib/fna-questions";

/**
 * Daftar pertanyaan pilihan tunggal — dipakai kuesioner topik prioritas dan
 * Kuesioner Profil Risiko. Komponen ini murni tampilan: pemuatan, penyimpanan,
 * dan perpindahan halaman diurus pemanggilnya.
 */
export function FnaQuestionList({
  questions,
  answers,
  showErrors,
  onPick,
  bare,
}: {
  questions: FnaQuestion[];
  answers: Record<string, string>;
  showErrors: boolean;
  onPick: (questionKey: string, option: string) => void;
  /** Tanpa bingkai kartu, untuk dipakai di dalam kartu lain. */
  bare?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-6",
        !bare && "rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card sm:p-6"
      )}
    >
      {questions.map((question, nomor) => {
        const kosong = showErrors && !answers[question.key];

        return (
          <fieldset
            key={question.key}
            id={`pertanyaan-${question.key}`}
            className="flex flex-col gap-3 border-b border-pfi-hairline pb-6 last:border-b-0 last:pb-0"
          >
            <legend className="mb-3 text-base font-bold text-pfi-heading">
              {nomor + 1}. {question.text}
            </legend>

            {question.options.map((option) => {
              const dipilih = answers[question.key] === option;

              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-[10px] border bg-white px-4 py-3.5 transition",
                    dipilih
                      ? "border-pfi-radio"
                      : kosong
                        ? "border-pfi-down-fg/40 hover:bg-pfi-hairline"
                        : "border-pfi-line hover:bg-pfi-hairline"
                  )}
                >
                  <input
                    type="radio"
                    name={question.key}
                    value={option}
                    checked={dipilih}
                    onChange={() => onPick(question.key, option)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border-2",
                      dipilih ? "border-pfi-radio" : "border-pfi-line"
                    )}
                  >
                    {dipilih && <span className="size-2.5 rounded-full bg-pfi-radio" />}
                  </span>
                  <span className="text-base text-pfi-heading">{option}</span>
                </label>
              );
            })}

            {kosong && (
              <p className="text-xs font-medium text-pfi-down-fg">
                Pertanyaan ini wajib dijawab.
              </p>
            )}
          </fieldset>
        );
      })}
    </section>
  );
}
