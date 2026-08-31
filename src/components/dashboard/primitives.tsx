/* eslint-disable @next/next/no-img-element -- Ikon di bawah adalah SVG statis hasil
   ekspor Figma; next/image tidak mengoptimalkan SVG sehingga <img> lebih ringan. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { CountCard, Delta } from "@/lib/dashboard-data";

/** Kartu putih standar desain: radius 10, garis #f1f5f9, bayangan lembut. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[10px] border border-pfi-hairline bg-white shadow-card",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Judul seksi + tautan opsional di kanan. */
export function SectionHeader({
  title,
  actionLabel,
  tone = "heading",
}: {
  title: string;
  actionLabel?: string;
  tone?: "heading" | "title";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        className={cn(
          "text-base font-bold",
          tone === "heading" ? "text-pfi-heading" : "text-pfi-title"
        )}
      >
        {title}
      </h2>
      {actionLabel && (
        <button
          type="button"
          className="flex shrink-0 items-center gap-2.5 text-sm font-bold text-pfi-link transition hover:underline"
        >
          {actionLabel}
          <img src="/dashboard/chevron-right.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>
      )}
    </div>
  );
}

/** Chip persentase hijau/merah + keterangan "vs last month". */
export function DeltaChip({ delta }: { delta: Delta }) {
  const naik = delta.value >= 0;
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "rounded-full px-1 py-0.5 text-xs/[14px] font-bold",
          naik ? "bg-pfi-up-bg text-pfi-up-fg" : "bg-pfi-down-bg text-pfi-down-fg"
        )}
      >
        {naik ? "+" : ""}
        {delta.value}%
      </span>
      <span className="text-[10px] text-pfi-subtle">{delta.label}</span>
    </div>
  );
}

/** Bulatan latar untuk ikon seksi. */
export function IconBubble({
  src,
  size = 22,
  tint = "blue",
}: {
  src: string;
  size?: 16 | 22;
  tint?: "blue" | "blue-alt";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full p-2",
        tint === "blue" ? "bg-pfi-tint" : "bg-pfi-tint-alt"
      )}
    >
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn("max-w-none object-contain", size === 16 ? "size-4" : "size-[22px]")}
      />
    </span>
  );
}

/** Kartu "ikon + label + angka" yang dipakai seksi Aktivitas dan Informasi Lead. */
export function StatRowCard({ card }: { card: CountCard }) {
  return (
    <Panel className="flex items-center justify-between gap-3 overflow-hidden p-4">
      <div className="flex min-w-0 items-center gap-4">
        <IconBubble src={card.icon} tint={card.tint} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="truncate text-sm font-semibold text-pfi-heading">{card.label}</p>
          <p className="truncate text-[10px]/[14px] text-pfi-subtle">{card.caption}</p>
        </div>
      </div>
      <p className="shrink-0 text-xl/[24px] font-bold text-pfi-heading tabular-nums">{card.value}</p>
    </Panel>
  );
}
