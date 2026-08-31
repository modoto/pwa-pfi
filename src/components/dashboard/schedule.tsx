"use client";

/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { ActivityCategory, DashboardData, ScheduleItem } from "@/lib/dashboard-data";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const DOT_COLOR: Record<ActivityCategory, string> = {
  leads: "bg-pfi-accent",
  training: "bg-pfi-amber",
};

type Schedule = DashboardData["schedule"];

/** Titik penanda kategori di bawah angka tanggal. */
function DayMarks({ categories }: { categories: ActivityCategory[] }) {
  return (
    <span className="absolute bottom-1.5 flex items-center gap-1.5">
      {categories.map((category) => (
        <span key={category} className={cn("size-[5px] rounded-full", DOT_COLOR[category])} />
      ))}
    </span>
  );
}

function Calendar({ schedule }: { schedule: Schedule }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(schedule.selectedDay);

  // Bulan dasar diambil dari data; navigasi hanya menggeser tampilan grid.
  const baseMonth = MONTHS.indexOf(schedule.month);

  const view = useMemo(() => {
    const date = new Date(schedule.year, baseMonth + monthOffset, 1);
    return {
      label: MONTHS[date.getMonth()],
      firstWeekday: monthOffset === 0 ? schedule.firstWeekday : date.getDay(),
      daysInMonth:
        monthOffset === 0
          ? schedule.daysInMonth
          : new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
      isBaseMonth: monthOffset === 0,
    };
  }, [baseMonth, monthOffset, schedule]);

  const marks = new Map(view.isBaseMonth ? schedule.marks.map((m) => [m.day, m.categories]) : []);

  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-[14px] border border-pfi-line bg-white lg:w-[449px]">
      <div className="flex items-center justify-between py-4">
        <button
          type="button"
          onClick={() => setMonthOffset((offset) => offset - 1)}
          aria-label="Bulan sebelumnya"
          className="rounded-full p-2 transition hover:bg-pfi-hairline"
        >
          <img src="/dashboard/cal-prev.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>

        <h3 className="text-base font-semibold text-pfi-heading">{view.label}</h3>

        <button
          type="button"
          onClick={() => setMonthOffset((offset) => offset + 1)}
          aria-label="Bulan berikutnya"
          className="rounded-full p-2 transition hover:bg-pfi-hairline"
        >
          <img src="/dashboard/cal-next.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="p-2.5 text-center text-sm/[20px] text-pfi-subtle">
            {day}
          </div>
        ))}

        {Array.from({ length: view.firstWeekday }, (_, i) => (
          <div key={`kosong-${i}`} aria-hidden />
        ))}

        {Array.from({ length: view.daysInMonth }, (_, i) => i + 1).map((day) => {
          const categories = marks.get(day);
          const isSelected = view.isBaseMonth && day === selected;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(day)}
              aria-pressed={isSelected}
              className={cn(
                "relative flex min-h-[52px] flex-col items-center justify-center text-sm text-pfi-subtle transition",
                isSelected
                  ? "rounded-[10px] border border-pfi-sel-border bg-pfi-sel-bg"
                  : categories
                    ? "rounded-[10px] bg-pfi-day"
                    : "rounded-full hover:bg-pfi-hairline"
              )}
            >
              {day}
              {categories && <DayMarks categories={categories} />}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2.5 text-sm text-pfi-heading">
            <img src="/dashboard/legend-leads.svg" alt="" aria-hidden className="size-2 max-w-none object-contain" />
            Leads
          </span>
          <span className="flex items-center gap-2.5 text-sm text-pfi-heading">
            <img
              src="/dashboard/legend-training.svg"
              alt=""
              aria-hidden
              className="size-2 max-w-none object-contain"
            />
            Training
          </span>
        </div>

        <span className="flex items-center gap-2.5 text-sm text-pfi-heading">
          <span className="size-[18px] rounded-[5px] border border-pfi-sel-border bg-pfi-sel-bg" />
          Hari Ini
        </span>
      </div>
    </div>
  );
}

function ActivityCard({ item }: { item: ScheduleItem }) {
  return (
    <article
      className={cn(
        "rounded-[10px] border border-pfi-hairline bg-white",
        "border-l-[3px]",
        item.category === "leads" ? "border-l-pfi-accent" : "border-l-pfi-amber"
      )}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <h4 className="truncate text-base font-semibold text-pfi-label">{item.title}</h4>
        <span
          className={cn(
            "shrink-0 rounded-[5px] px-1.5 py-1 text-xs font-medium",
            item.category === "leads"
              ? "bg-pfi-tint text-pfi-accent"
              : "bg-amber-50 text-pfi-amber"
          )}
        >
          {item.badge}
        </span>
      </div>

      <div className="border-t border-pfi-hairline px-3 pb-3 pt-3">
        <p className="flex items-center gap-2.5 text-sm text-pfi-muted">
          <img src="/dashboard/item-note.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
          <span className="truncate">{item.note}</span>
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-sm text-pfi-muted">
          <span className="flex items-center gap-2.5">
            <img
              src="/dashboard/item-location.svg"
              alt=""
              aria-hidden
              className="size-4 max-w-none object-contain"
            />
            {item.place}
          </span>
          <img src="/dashboard/item-dot.svg" alt="" aria-hidden className="size-1 max-w-none object-contain" />
          <span className="flex items-center gap-2.5">
            <img src="/dashboard/item-clock.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
            {item.time}
          </span>
        </div>

        <p className="mt-2.5 flex items-center gap-2.5 text-sm text-pfi-muted">
          <img src="/dashboard/item-note.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
          {item.tag}
        </p>
      </div>
    </article>
  );
}

export function SchedulePanel({ schedule }: { schedule: Schedule }) {
  const [activeTab, setActiveTab] = useState(schedule.activeTab);

  return (
    <div className="flex flex-col gap-5 rounded-[14px] border border-pfi-hairline bg-white p-5 shadow-card lg:flex-row lg:items-start">
      <Calendar schedule={schedule} />

      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <div className="flex gap-6 overflow-x-auto pb-1">
          {schedule.tabs.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={active}
                className={cn(
                  "flex shrink-0 items-start gap-6 rounded-[43px] border px-3.5 py-2.5 text-sm transition",
                  active
                    ? "border-pfi-link bg-pfi-tint font-bold text-pfi-link"
                    : "border-pfi-line bg-white font-semibold text-pfi-muted hover:bg-pfi-hairline"
                )}
              >
                {tab.label}
                <span className={cn(active ? "text-pfi-link" : "text-pfi-heading")}>{tab.count}</span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-pfi-hairline" />

        <div className="flex items-center justify-between gap-3 text-sm text-pfi-muted">
          <p className="font-bold">{schedule.dateLabel}</p>
          <p className="shrink-0 font-medium">{schedule.items.length} aktivitas</p>
        </div>

        <div className="flex flex-col gap-5">
          {schedule.items.map((item) => (
            <ActivityCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
