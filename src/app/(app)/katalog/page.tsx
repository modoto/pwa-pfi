import type { Metadata } from "next";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { formatRupiah } from "@/lib/utils";

export const metadata: Metadata = { title: "Katalog" };

const produk = [
  { nama: "Kopi Arabika Gayo", kategori: "Minuman", harga: 85000, stok: 42, gradien: "from-amber-400 to-orange-500" },
  { nama: "Teh Hijau Premium", kategori: "Minuman", harga: 62000, stok: 18, gradien: "from-emerald-400 to-teal-500" },
  { nama: "Madu Hutan Asli", kategori: "Makanan", harga: 120000, stok: 7, gradien: "from-yellow-400 to-amber-600" },
  { nama: "Keripik Singkong", kategori: "Makanan", harga: 25000, stok: 96, gradien: "from-lime-400 to-green-500" },
  { nama: "Cokelat Batang 70%", kategori: "Makanan", harga: 45000, stok: 0, gradien: "from-stone-500 to-amber-800" },
  { nama: "Gula Aren Cair", kategori: "Bahan", harga: 38000, stok: 55, gradien: "from-orange-400 to-rose-500" },
];

export default function KatalogPage() {
  return (
    <>
      {/* Baris pencarian: menumpuk di HP, sejajar mulai sm */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Cari produk…"
            aria-label="Cari produk"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-800 dark:bg-slate-900 dark:focus:ring-brand-500/20"
          />
        </label>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filter
        </button>
      </div>

      {/* Chip kategori: bisa digeser horizontal di layar sempit */}
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
        {["Semua", "Minuman", "Makanan", "Bahan", "Peralatan", "Promo"].map((kategori, index) => (
          <button
            key={kategori}
            type="button"
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
              index === 0
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            {kategori}
          </button>
        ))}
      </div>

      {/* Grid: 1 kolom HP kecil, 2 kolom HP besar, 3 kolom tablet, 4 kolom desktop */}
      <div className="mt-5 grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {produk.map((item) => (
          <Card key={item.nama} className="flex flex-col gap-3 p-3 sm:p-4">
            <div
              className={`aspect-4/3 w-full rounded-xl bg-linear-to-br ${item.gradien}`}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.nama}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.kategori}</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold tabular-nums">{formatRupiah(item.harga)}</span>
              <Badge tone={item.stok === 0 ? "slate" : item.stok < 20 ? "amber" : "green"}>
                {item.stok === 0 ? "Habis" : `Stok ${item.stok}`}
              </Badge>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
