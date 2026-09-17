"use client";

/**
 * Pembuat `.docx` RIPLAY Personal yang sudah terisi.
 *
 * Templatenya dibongkar sebagai zip, penanda di `word/document.xml` (juga
 * header dan footer) diganti nilai ilustrasi, lalu dikemas ulang. Penanda
 * yang terpecah antar-run sudah digabung oleh `muatTemplate`, jadi tiap
 * penanda utuh dalam satu `<w:t>` dan penggantian teks biasa sudah cukup —
 * tidak perlu pustaka template dokumen.
 *
 * Penggantian menyusuri elemen `<w:t>` sesuai urutan dokumen memakai pengisi
 * yang sama dengan pratinjau, sehingga penanda berulang (tabel proyeksi 60
 * baris) mendapat nilai baris yang benar dan isi berkas persis seperti yang
 * terlihat di layar.
 *
 * Berkas ini dipakai dua jalur: unduhan `.docx` (riplay-download.ts) dan
 * konversi ke PDF di server (riplay-pdf.ts), supaya keduanya tidak pernah
 * menghasilkan dokumen yang berbeda.
 */

import { createTextFiller, type RiplayFill } from "@/lib/riplay-fill";
import { RIPLAY_PARTS, muatTemplate } from "@/lib/riplay-template";
import { sisipkanTandaTangan, type TandaTanganRiplay } from "@/lib/riplay-signature";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const unescapeXml = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Nama berkas tanpa karakter yang ditolak sistem berkas. */
export const bersihkanNamaBerkas = (value: string) =>
  value.replace(/[\\/:*?"<>|]+/g, " ").trim();

/** Nama berkas unduhan, tanpa ekstensi. */
export const namaBerkasRiplay = (namaPemegangPolis: string) =>
  `RIPLAY Personal - ${bersihkanNamaBerkas(namaPemegangPolis) || "Nasabah"}`;

/**
 * Template RIPLAY yang penandanya sudah diganti nilai ilustrasi, lengkap dengan
 * gambar tanda tangan bila langkah Tanda Tangan sudah diisi.
 */
export async function buatDocxRiplay(
  templateUrl: string,
  fill: RiplayFill,
  ttd: TandaTanganRiplay = {}
): Promise<Blob> {
  const zip = await muatTemplate(templateUrl);
  await sisipkanTandaTangan(zip, ttd);

  for (const path of Object.keys(zip.files).filter((name) => RIPLAY_PARTS.test(name))) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;

    // Penghitung urutan berlaku per berkas, jadi pengisinya dibuat ulang.
    const isi = createTextFiller(fill);

    // Hanya isi elemen teks; sisa XML tidak boleh tersentuh. Di dalam XML
    // tanda kurung sudutnya tersimpan sebagai entitas.
    const hasil = xml.replace(
      /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g,
      (_cocok, buka: string, teks: string, tutup: string) =>
        buka + escapeXml(isi(unescapeXml(teks))) + tutup
    );

    zip.file(path, hasil);
  }

  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}

/** Tawarkan blob sebagai unduhan berkas. */
export function unduhBlob(blob: Blob, namaBerkas: string) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = namaBerkas;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Beri jeda supaya unduhan sempat dimulai sebelum URL-nya dilepas.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
