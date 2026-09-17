import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, House } from "lucide-react";

/**
 * Header halaman: bar judul dengan tombol kembali, menempel di puncak layar.
 *
 * Pada grup layout (fullscreen) tidak ada header agen, jadi bar inilah
 * headernya — karena itu `sticky top-0` dan memakai padding aman untuk notch.
 * Judulnya "FnA", kecuali langkah Rekomendasi Produk yang memakai "Produk"
 * dan alur ilustrasi yang memakai "Ilustrasi".
 *
 * Di ujung kanan ada pintasan ke Beranda: alur FnA dan ilustrasi panjang, dan
 * tombol kembali hanya mundur satu langkah — tanpa pintasan ini agen harus
 * menekannya berkali-kali untuk keluar.
 */
export function FnaHeader({ backHref, title = "FnA" }: { backHref: string; title?: string }) {
  return (
    // `pt-safe` dipasang di pembungkus, bukan di baris isinya: menaruhnya
    // bersama `py-4` membuat padding atas ikut jadi nol di perangkat tanpa notch.
    <div className="pt-safe sticky top-0 z-30 -mx-4 border-b border-pfi-hairline bg-white sm:-mx-6">
      <div className="flex items-center gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <Link
          href={backHref}
          aria-label="Kembali ke halaman sebelumnya"
          className="grid size-12 shrink-0 place-items-center rounded-[10px] border border-pfi-line bg-white text-pfi-heading transition hover:bg-pfi-hairline"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <h1 className="min-w-0 truncate text-xl font-bold text-pfi-heading">{title}</h1>

        <Link
          href="/"
          aria-label="Ke Beranda"
          title="Ke Beranda"
          className="ml-auto flex h-12 shrink-0 items-center gap-2.5 rounded-[10px] border border-pfi-line bg-white px-3.5 text-pfi-heading transition hover:bg-pfi-hairline sm:px-4"
        >
          <House className="size-6" aria-hidden />
          <span className="hidden text-base font-medium sm:inline">Beranda</span>
        </Link>
      </div>
    </div>
  );
}

/**
 * Spanduk biru selebar layar di bawah bar judul.
 *
 * `-mt-6` meniadakan jarak dari induknya (kolom `gap-6`) supaya spanduk
 * menempel pada bar judul seperti di desain.
 */
export function FnaBanner({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 -mt-6 bg-pfi-proses px-4 py-6 sm:-mx-6 sm:px-6">
      <p className="text-center text-2xl font-bold text-white">{children}</p>
    </div>
  );
}

const nextClass =
  "flex-1 rounded-[10px] bg-pfi-orange px-6 py-3.5 text-center text-base font-medium text-white transition";

/**
 * Pasangan tombol Kembali / Selanjutnya di dasar tiap langkah FnA.
 *
 * `onNext` dipakai bila tujuannya baru ditentukan saat diklik (mis. setelah
 * memeriksa jawaban yang kosong); selain itu cukup `nextHref`.
 */
export function FnaFooter({
  backHref,
  nextHref,
  onNext,
  disabledReason,
  nextLabel = "Selanjutnya",
}: {
  backHref: string;
  nextHref?: string;
  onNext?: () => void;
  disabledReason?: string;
  nextLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Link
        href={backHref}
        className="rounded-[10px] border border-pfi-line bg-white px-6 py-3.5 text-center text-base font-medium text-pfi-heading transition hover:bg-pfi-hairline sm:w-1/3"
      >
        Kembali
      </Link>

      {disabledReason ? (
        <button
          type="button"
          disabled
          title={disabledReason}
          className={`${nextClass} cursor-not-allowed opacity-60`}
        >
          {nextLabel}
        </button>
      ) : onNext ? (
        <button type="button" onClick={onNext} className={`${nextClass} hover:bg-pfi-orange-dark`}>
          {nextLabel}
        </button>
      ) : (
        <Link href={nextHref ?? backHref} className={`${nextClass} hover:bg-pfi-orange-dark`}>
          {nextLabel}
        </Link>
      )}
    </div>
  );
}
