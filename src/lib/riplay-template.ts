"use client";

/**
 * Pemuat template RIPLAY (.docx) dari public/riplay/.
 *
 * Word kerap memecah satu penanda ke beberapa `<w:r>`, mis. `<Regular Basic `
 * di satu run dan `premium>` di run berikutnya — biasanya sisa pemeriksaan
 * ejaan. Penanda seperti itu tidak akan pernah cocok saat diisi, jadi setelah
 * diunduh run-run tersebut digabung dulu. Dilakukan di sini (bukan saat build)
 * supaya template baru dari tim bisnis cukup ditaruh di public/riplay/.
 */

import type JSZip from "jszip";

/** Bagian dokumen yang berisi penanda. */
export const RIPLAY_PARTS = /^word\/(document|header\d*|footer\d*)\.xml$/;

const PARAGRAF = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
const RUN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
const TEKS = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/;

/** Jumlah kurung penanda (`<` atau `[`) yang belum ditutup pada sepotong teks XML. */
function terbuka(teks: string): number {
  const hitung = (pola: RegExp) => (teks.match(pola) ?? []).length;
  return Math.max(hitung(/&lt;/g) - hitung(/&gt;/g), 0) + Math.max(hitung(/\[/g) - hitung(/\]/g), 0);
}

/**
 * Gabungkan run-run yang penandanya terpotong. Teksnya dipindahkan ke run
 * pertama; run berikutnya dikosongkan agar gaya dan properti lainnya utuh.
 */
function rapikanParagraf(paragraf: string): string {
  const runs = [...paragraf.matchAll(RUN)].map((m) => m[0]);
  if (runs.length < 2) return paragraf;
  if (!runs.some((run) => terbuka(TEKS.exec(run)?.[2] ?? "") > 0)) return paragraf;

  const hasil = [...runs];
  let digabung = false;

  for (let i = 0; i < hasil.length; i++) {
    const isi = TEKS.exec(hasil[i]);
    if (!isi || terbuka(isi[2]) <= 0) continue;

    let gabungan = isi[2];
    let j = i + 1;

    while (j < hasil.length && terbuka(gabungan) > 0) {
      const lanjutan = TEKS.exec(hasil[j]);
      // Run tanpa teks (mis. hanya penanda ejaan) dilompati, bukan penghenti.
      if (lanjutan) {
        gabungan += lanjutan[2];
        hasil[j] = hasil[j].replace(TEKS, "$1$3");
      }
      j += 1;
    }

    if (gabungan !== isi[2]) {
      hasil[i] = hasil[i].replace(TEKS, (_cocok, buka: string) => {
        const pembuka = buka.includes("xml:space") ? buka : buka.replace(/>$/, ' xml:space="preserve">');
        return `${pembuka}${gabungan}</w:t>`;
      });
      digabung = true;
    }
  }

  if (!digabung) return paragraf;

  let ke = 0;
  return paragraf.replace(RUN, () => hasil[ke++]);
}

export function rapikanPenanda(xml: string): string {
  return xml.replace(PARAGRAF, rapikanParagraf);
}

/** Unduh template lalu rapikan penandanya; hasilnya zip siap diisi atau dirender. */
export async function muatTemplate(url: string): Promise<JSZip> {
  const [{ default: JSZipClass }, response] = await Promise.all([import("jszip"), fetch(url)]);
  if (!response.ok) throw new Error(`Template RIPLAY tidak ditemukan (${response.status}).`);

  const zip = await JSZipClass.loadAsync(await response.arrayBuffer());

  for (const path of Object.keys(zip.files).filter((name) => RIPLAY_PARTS.test(name))) {
    const xml = await zip.file(path)?.async("string");
    if (xml) zip.file(path, rapikanPenanda(xml));
  }

  return zip;
}
