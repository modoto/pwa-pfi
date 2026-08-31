/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import type { PerformanceBlock } from "@/lib/dashboard-data";
import { DeltaChip } from "./primitives";

/**
 * Kartu Performa MTD / YTD: header dengan ikon + tautan detail, lalu 2x2 metrik.
 * Di HP grid metrik tetap 2 kolom supaya angka tidak terlalu panjang ke bawah.
 */
export function PerformanceCard({ block }: { block: PerformanceBlock }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-pfi-hairline bg-white shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-pfi-hairline p-3">
        <div className="flex items-center gap-5">
          <span className="grid shrink-0 place-items-center rounded-full bg-pfi-tint p-2">
            <img src="/dashboard/perf-chart.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
          </span>
          <h2 className="text-base font-bold text-pfi-heading">{block.title}</h2>
        </div>

        <button
          type="button"
          className="flex shrink-0 items-center gap-2.5 text-sm font-bold text-pfi-link transition hover:underline"
        >
          Lihat Detail
          <img src="/dashboard/chevron-right.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3.5 p-3.5">
        {block.metrics.map((metric) => (
          <div
            key={metric.key}
            className="flex flex-col gap-3.5 overflow-hidden rounded-lg border border-pfi-hairline bg-white p-2.5"
          >
            <p className="truncate text-sm font-semibold text-pfi-muted">{metric.label}</p>
            <p className="text-base/[14px] font-bold text-pfi-heading tabular-nums">{metric.value}</p>
            <DeltaChip delta={metric.delta} />
          </div>
        ))}
      </div>
    </section>
  );
}
