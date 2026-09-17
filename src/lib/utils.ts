/**
 * Lebar isi halaman pada layar besar.
 *
 * Dipasang per halaman, bukan di `main` pada kerangka aplikasi, supaya halaman
 * yang butuh selebar layar — mis. Daftar Leads dengan tabel banyak kolom —
 * bisa memakai seluruh ruang tanpa trik negative margin.
 */
export const LEBAR_HALAMAN = "mx-auto w-full max-w-[1366px]";

/** Gabungkan className secara kondisional tanpa dependency tambahan. */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
