import Link from "next/link";

/**
 * Pemberitahuan saat tabel master yang dibutuhkan belum pernah ditarik.
 *
 * Layar-layar ini sengaja tidak memanggil API langsung (harus jalan offline),
 * jadi satu-satunya jalan adalah menarik master data dari halaman Profil.
 */
export function MasterMissing({ label }: { label: string }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
      <p className="text-base font-bold text-pfi-heading">Master {label} belum ditarik</p>
      <p className="max-w-[520px] text-sm text-pfi-muted">
        Data ini dibaca dari database lokal perangkat, bukan langsung dari server. Tarik master
        data lebih dulu saat online, lalu buka halaman ini lagi.
      </p>
      <Link href="/profil" className="mt-2 text-sm font-bold text-pfi-link hover:underline">
        Buka Profil → Tarik semua master data
      </Link>
    </section>
  );
}
