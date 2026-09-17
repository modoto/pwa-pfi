import type { Metadata } from "next";
import { cn, LEBAR_HALAMAN } from "@/lib/utils";
import { PerformanceCard } from "@/components/dashboard/performance";
import { NewsSection } from "@/components/dashboard/news";
import { Panel, SectionHeader, StatRowCard } from "@/components/dashboard/primitives";
import { SchedulePanel } from "@/components/dashboard/schedule";
import { getDashboardData } from "@/lib/dashboard-data";

export const metadata: Metadata = {
  title: "Beranda",
};

export default function BerandaPage() {
  // TODO: ganti dengan panggilan API dashboard begitu endpoint-nya tersedia.
  const data = getDashboardData();

  return (
    <div className={cn(LEBAR_HALAMAN, "flex flex-col gap-6")}>
      {/* Performa MTD & YTD */}
      <div className="grid gap-6 lg:grid-cols-2">
        {data.performance.map((block) => (
          <PerformanceCard key={block.title} block={block} />
        ))}
      </div>

      {/* Aktivitas */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Aktivitas" />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {data.activities.map((card) => (
            <StatRowCard key={card.key} card={card} />
          ))}
        </div>
      </section>

      {/* Informasi Visit */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Informasi Visit" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {data.visits.map((visit) => (
            <Panel key={visit.key} className="flex flex-col items-center gap-4 overflow-hidden p-4">
              <p className="text-center text-sm font-semibold text-pfi-muted">{visit.label}</p>
              <p className="text-2xl/[24px] font-bold text-pfi-heading tabular-nums">
                {visit.value}
              </p>
            </Panel>
          ))}
        </div>
      </section>

      {/* Jadwal Aktivitas */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Jadwal Aktivitas" actionLabel="Buka Kalender" tone="title" />
        <SchedulePanel schedule={data.schedule} />
      </section>

      {/* Informasi Lead */}
      <section className="flex flex-col gap-4">
        <SectionHeader title="Informasi Lead" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.leads.map((card) => (
            <StatRowCard key={card.key} card={card} />
          ))}
        </div>
      </section>

      <NewsSection items={data.news} />
    </div>
  );
}
