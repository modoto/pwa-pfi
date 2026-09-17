"use client";

import { useEffect, useId } from "react";
import { cn } from "@/lib/utils";
import { FNA_TOPICS, type FnaTopic } from "@/lib/fna-data";

const FNA_QUESTION = "Apa yang menjadi tujuan keuangan Anda dalam 5 – 20 tahun kedepan?";
const FNA_HINT = "Pilih sesuai urutan prioritas keuangan Anda";

/** Tutup dengan Escape dan kunci gulir halaman selama modal terbuka. */
function useModalChrome(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
}

function Backdrop({
  onClose,
  labelledBy,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="flex max-h-[88dvh] w-full max-w-[860px] flex-col gap-6 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        {children}
      </div>
    </div>
  );
}

const backButtonClass =
  "mx-auto w-full max-w-[320px] rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 " +
  "text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline";

/**
 * Modal pilih topik untuk satu slot prioritas.
 *
 * Topik yang sudah dipakai slot lain tidak ditawarkan lagi, sehingga tidak
 * mungkin ada prioritas ganda.
 */
export function FnaTopicModal({
  taken,
  onPick,
  onClose,
}: {
  taken: string[];
  onPick: (topic: FnaTopic) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  useModalChrome(onClose);

  return (
    <Backdrop onClose={onClose} labelledBy={titleId}>
      <div className="flex flex-col gap-2 text-center">
        <h2 id={titleId} className="text-xl font-bold text-pfi-heading">
          {FNA_QUESTION}
        </h2>
        <p className="text-base text-pfi-muted">{FNA_HINT}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {FNA_TOPICS.filter((topic) => !taken.includes(topic.key)).map((topic) => (
          <button
            key={topic.key}
            type="button"
            onClick={() => onPick(topic)}
            className={cn(
              "flex flex-col items-center gap-4 rounded-[10px] border border-pfi-link/60 bg-white",
              "px-5 py-8 transition hover:border-pfi-link hover:bg-pfi-tint"
            )}
          >
            <span className="grid size-14 place-items-center rounded-[10px] bg-pfi-tint text-pfi-proses">
              <topic.icon className="size-7" aria-hidden />
            </span>
            <span className="text-lg font-bold text-pfi-heading">{topic.title}</span>
          </button>
        ))}
      </div>

      <button type="button" onClick={onClose} className={backButtonClass}>
        Kembali
      </button>
    </Backdrop>
  );
}

/** Penjelasan satu topik — isi yang sama dengan halaman "Tahukah Anda?". */
export function FnaTopicDetailModal({
  topic,
  onClose,
}: {
  topic: FnaTopic;
  onClose: () => void;
}) {
  const titleId = useId();
  useModalChrome(onClose);

  return (
    <Backdrop onClose={onClose} labelledBy={titleId}>
      <div className="flex flex-col gap-4">
        <span className="grid size-14 place-items-center rounded-[10px] bg-pfi-tint text-pfi-proses">
          <topic.icon className="size-7" aria-hidden />
        </span>
        <h2 id={titleId} className="text-xl font-bold uppercase text-pfi-heading">
          {topic.title}
        </h2>
        <p className="text-base text-pfi-heading">{topic.question}</p>
        <p className="text-base text-pfi-muted">{topic.body}</p>
      </div>

      <button type="button" onClick={onClose} className={backButtonClass}>
        Kembali
      </button>
    </Backdrop>
  );
}

export { FNA_QUESTION, FNA_HINT };
