import type { Metadata } from "next";
import { Activity, ShoppingBag, Target, Users } from "lucide-react";
import { Card, Section, StatCard } from "@/components/ui";
import { formatRupiah, LEBAR_HALAMAN } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistik" };

const bulan = [
  { label: "Jan", nilai: 42 },
  { label: "Feb", nilai: 58 },
  { label: "Mar", nilai: 51 },
  { label: "Apr", nilai: 74 },
  { label: "Mei", nilai: 66 },
  { label: "Jun", nilai: 88 },
  { label: "Jul", nilai: 79 },
  { label: "Agu", nilai: 96 },
];

const kanal = [
  { nama: "Toko offline", persen: 46 },
  { nama: "Marketplace", persen: 31 },
  { nama: "Media sosial", persen: 15 },
  { nama: "Lainnya", persen: 8 },
];

export default function StatistikPage() {
  return (
    <div className={LEBAR_HALAMAN}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Omzet bulan ini" value={formatRupiah(96400000)} delta="+18,2%" icon={ShoppingBag} />
        <StatCard label="Pengunjung" value="12.4rb" delta="+6,7%" icon={Users} />
        <StatCard label="Konversi" value="3,8%" delta="+0,4%" icon={Target} />
        <StatCard label="Rata-rata order" value={formatRupiah(285000)} delta="-2,1%" icon={Activity} />
      </div>

      {/* Dua kolom mulai tablet lanskap */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-base font-bold sm:text-lg">Penjualan 8 bulan terakhir</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dalam jutaan rupiah</p>

          <div className="mt-6 flex h-48 items-end gap-1.5 sm:h-56 sm:gap-3">
            {bulan.map((item) => (
              <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-semibold tabular-nums text-slate-500 sm:text-xs">
                  {item.nilai}
                </span>
                <div
                  className="w-full rounded-t-lg bg-linear-to-t from-brand-600 to-sky-400 transition-all"
                  style={{ height: `${item.nilai}%` }}
                  role="img"
                  aria-label={`${item.label}: ${item.nilai} juta`}
                />
                <span className="text-[10px] text-slate-500 sm:text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-base font-bold sm:text-lg">Sumber penjualan</h2>
          <ul className="mt-4 space-y-4">
            {kanal.map((item) => (
              <li key={item.nama}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{item.nama}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {item.persen}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${item.persen}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Section title="Catatan">
        <Card className="text-sm/6 text-slate-600 dark:text-slate-400">
          Semua grafik di halaman ini dibuat memakai CSS murni (flex + persentase tinggi), jadi tetap
          tajam di layar HP maupun tablet tanpa library chart tambahan.
        </Card>
      </Section>
    </div>
  );
}
