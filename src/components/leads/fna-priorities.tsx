"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FnaBanner, FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import {
  FNA_HINT,
  FNA_QUESTION,
  FnaTopicDetailModal,
  FnaTopicModal,
} from "@/components/leads/fna-topic-modal";
import { PRIORITY_LABELS, topicByKey, type FnaTopic } from "@/lib/fna-data";
import { listPriorities, setPriority, type PriorityRow } from "@/lib/db/fna-repo";

const SLOTS = [1, 2, 3, 4] as const;

/**
 * Langkah kedua FnA — empat slot prioritas keuangan.
 *
 * Slot diisi berurutan: slot berikutnya baru terbuka setelah slot sebelumnya
 * terisi. Slot yang sudah terisi tetap bisa diklik untuk mengganti pilihan.
 */
export function FnaPriorities({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const [rows, setRows] = useState<PriorityRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const [detail, setDetail] = useState<FnaTopic | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listPriorities(leadId));
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

  const detailHref = `/leads/details/${leadId}`;
  const topicOf = (urutan: number) => {
    const row = rows.find((item) => item.urutan === urutan);
    return row ? topicByKey(row.topik) : null;
  };

  // Slot kosong pertama; slot sesudahnya masih terkunci.
  const nextSlot = SLOTS.find((urutan) => !topicOf(urutan)) ?? SLOTS.length + 1;

  async function pick(topic: FnaTopic) {
    if (picking === null) return;

    try {
      await setPriority(leadId, picking, topic.key, agentName);
      await load();
      setPicking(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.");
      setState("error");
      setPicking(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={`${detailHref}/fna`} />
      <FnaBanner>Pilih Prioritas Keuangan</FnaBanner>

      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-xl font-bold text-pfi-heading">{FNA_QUESTION}</h2>
        <p className="text-base text-pfi-muted">{FNA_HINT}</p>
      </div>

      {state === "error" && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SLOTS.map((urutan) => {
            const topic = topicOf(urutan);
            const locked = urutan > nextSlot;

            return (
              <div
                key={urutan}
                className={cn(
                  "flex min-h-[280px] flex-col items-center gap-4 rounded-[14px] border p-5",
                  locked
                    ? "border-pfi-chip-border bg-pfi-chip-bg"
                    : "border-pfi-link/60 bg-white"
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-medium",
                    locked
                      ? "border-pfi-subtle text-pfi-subtle"
                      : "border-pfi-link text-pfi-link"
                  )}
                >
                  {urutan}
                </span>

                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                  {topic ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPicking(urutan)}
                        className="text-lg font-bold text-pfi-heading hover:underline"
                      >
                        {topic.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetail(topic)}
                        className="text-sm font-medium text-pfi-orange hover:underline"
                      >
                        Lihat Detail
                      </button>
                    </>
                  ) : locked ? (
                    <p className="text-base text-pfi-subtle">{PRIORITY_LABELS[urutan - 1]}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPicking(urutan)}
                      className="text-base text-pfi-muted hover:text-pfi-link hover:underline"
                    >
                      {PRIORITY_LABELS[urutan - 1]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FnaFooter
        backHref={`${detailHref}/fna`}
        nextHref={rows[0] && `${detailHref}/fna/questions/${rows[0].topik}`}
        disabledReason={rows.length === 0 ? "Pilih prioritas pertama terlebih dahulu" : undefined}
      />

      {picking !== null && (
        <FnaTopicModal
          taken={rows.filter((row) => row.urutan !== picking).map((row) => row.topik)}
          onPick={pick}
          onClose={() => setPicking(null)}
        />
      )}

      {detail && <FnaTopicDetailModal topic={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
