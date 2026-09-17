/**
 * Pengisian penanda `<...>` pada template RIPLAY.
 *
 * Sebagian penanda muncul berkali-kali dengan nilai berbeda — tabel proyeksi
 * memakai `<Policy year>` 60 kali dan `<refer to actuarial calc>` 324 kali —
 * jadi penggantiannya harus mengikuti urutan kemunculan, bukan sekadar cari
 * dan ganti. Modul ini dipakai bersama oleh pratinjau di layar dan pembuatan
 * berkas .docx supaya keduanya tidak mungkin berbeda isi.
 */

export type RiplayFill = {
  /**
   * Penanda yang nilainya sama di mana pun muncul. Dicocokkan persis dulu,
   * lalu tanpa memedulikan huruf besar/kecil dan tanda baca — tiap template
   * menulis penanda yang sama dengan ejaan berbeda (`<Insured age>`,
   * `<age of insured>`, `<Age of Insured>`).
   */
  values: Record<string, string>;
  /** Penanda berurutan (dicocokkan persis); kemunculan setelah daftarnya habis dibiarkan. */
  sequences: Record<string, string[]>;
  /** Kemunculan awal yang sengaja dilewati (mis. tabel asumsi imbal hasil). */
  skips: Record<string, number>;
  /**
   * Penanda yang dihapus dari dokumen: petunjuk untuk penyusun template
   * ("baris ini muncul bila rider dipilih"), bukan nilai yang harus tampil.
   * Petunjuk yang berpola umum sudah dikenali otomatis (`isInstruction`).
   */
  blanks: string[];
  /**
   * Teks tetap (bukan penanda) yang diganti setelah penanda diisi, mis. teks
   * contoh "The value shown is Cash value…" di tabel MAME. Nilai berupa daftar
   * dipakai berurutan per kemunculan; string dipakai untuk semua kemunculan.
   */
  literals?: [teks: string, pengganti: string | string[]][];
  /**
   * Teks yang dibersihkan **sebelum** penanda diisi. Dipakai untuk sisa contoh
   * di template, mis. template MAMS menulis `<Policy year> 11` — angka 11 itu
   * contoh lama yang kalau dibiarkan menempel di hasil isian ("1711").
   */
  literalsBefore?: [teks: string, pengganti: string][];
};

/**
 * Penanda `<...>`; template Mega Warisan memakai kurung siku `[...]`. Isi
 * kurung yang tidak dikenal dibiarkan apa adanya.
 */
export const TOKEN_PATTERN = /<([^<>]{2,120})>|\[([^[\]]{2,120})\]/g;

/** Kunci pembanding: huruf kecil, tanpa spasi dan tanda baca. */
export const normalizeToken = (token: string) =>
  token.toLowerCase().replace(/[^a-z0-9%+]/g, "");

/**
 * Petunjuk penyusun template, mis. "This row showed only rider is chosen",
 * "Only showed if CI taken", "If rider MWA is taken".
 */
export function isInstruction(token: string): boolean {
  const teks = token.trim().toLowerCase();
  return (
    /^(this (row|section|table)|only (show|appear)|showed? (only|if)|if rider)/.test(teks) ||
    /\b(showed|appear) only\b/.test(teks)
  );
}

/**
 * Pembaca nilai satu berkas. Buat baru untuk tiap berkas XML karena
 * penghitung urutannya berlaku per berkas.
 */
export function createFiller(fill: RiplayFill) {
  const dipakai = new Map<string, number>();
  const blanks = new Set(fill.blanks.map(normalizeToken));
  const longgar = new Map<string, string>();
  for (const [kunci, nilai] of Object.entries(fill.values)) {
    const normal = normalizeToken(kunci);
    if (!longgar.has(normal) && nilai !== "") longgar.set(normal, nilai);
  }

  return (token: string): string | null => {
    const kunci = token.trim();

    if (blanks.has(normalizeToken(kunci)) || isInstruction(kunci)) return "";

    const urutan = fill.sequences[kunci];
    if (urutan) {
      const dilewati = fill.skips[kunci] ?? 0;
      const ke = dipakai.get(kunci) ?? 0;
      dipakai.set(kunci, ke + 1);

      if (ke < dilewati) return null;
      return urutan[ke - dilewati] ?? null;
    }

    const nilai = fill.values[kunci];
    if (nilai !== undefined && nilai !== "") return nilai;

    return longgar.get(normalizeToken(kunci)) ?? null;
  };
}

/**
 * Pengisi satu potong teks (satu `<w:t>` / satu text node): penanda lalu teks
 * tetap. Buat baru untuk tiap berkas XML karena penghitung urutannya per berkas.
 */
export function createTextFiller(fill: RiplayFill): (teks: string) => string {
  const ambil = createFiller(fill);
  const literals = fill.literals ?? [];
  const dipakai = literals.map(() => 0);

  const sebelum = fill.literalsBefore ?? [];

  return (teks) => {
    let bersih = teks;
    for (const [cari, pengganti] of sebelum) {
      if (bersih.includes(cari)) bersih = bersih.split(cari).join(pengganti);
    }

    let hasil = /[<[]/.test(bersih) ? fillText(bersih, ambil) : bersih;

    literals.forEach(([cari, pengganti], i) => {
      if (!hasil.includes(cari)) return;
      hasil = hasil.split(cari).reduce((gabung, potong) => {
        const nilai = Array.isArray(pengganti) ? (pengganti[dipakai[i]++] ?? cari) : pengganti;
        return gabung + nilai + potong;
      });
    });

    return hasil;
  };
}

/** Ganti seluruh penanda pada satu potong teks; `null` berarti dibiarkan. */
export function fillText(teks: string, ambil: (token: string) => string | null): string {
  return teks.replace(
    TOKEN_PATTERN,
    (cocok, sudut: string | undefined, siku: string | undefined) => ambil(sudut ?? siku ?? "") ?? cocok
  );
}
