/**
 * Salin template RIPLAY Personal ke public/riplay/ sambil merapikan penandanya.
 *
 * Berkas aslinya disimpan di `src/replay/` sebagai sumber kebenaran (dikirim
 * tim bisnis) dan tidak pernah diubah. Salinan di public/ dipakai karena
 * dokumennya dirender di browser dengan docx-preview.
 *
 * Word kerap memecah satu penanda ke beberapa `<w:r>`, mis. `<Regular Basic `
 * di satu run dan `premium>` di run berikutnya — biasanya karena sisa
 * pemeriksaan ejaan. Penanda seperti itu tidak akan pernah cocok saat diisi,
 * jadi di salinan ini run-run tersebut digabung menjadi satu.
 *
 * Dijalankan otomatis lewat `postinstall`, `predev`, dan `prebuild`.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sumber = join(
  root,
  "src",
  "replay",
  "Ringkasan Informasi Produk dan Layanan_Personal_MSL.docx"
);
const tujuan = join(root, "public", "riplay");

const zip = await JSZip.loadAsync(readFileSync(sumber));

const RUN = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
const TEKS = /(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/;

/** Jumlah `<` yang belum ditutup `>` pada sepotong teks. */
function terbuka(teks) {
  const buka = (teks.match(/&lt;/g) ?? []).length;
  const tutup = (teks.match(/&gt;/g) ?? []).length;
  return buka - tutup;
}

/**
 * Gabungkan run-run yang penandanya terpotong. Teksnya dipindahkan ke run
 * pertama; run berikutnya dikosongkan agar gaya dan properti lainnya utuh.
 */
function rapikanParagraf(paragraf) {
  const runs = [...paragraf.matchAll(RUN)].map((m) => m[0]);
  if (runs.length < 2) return paragraf;

  const teks = runs.map((run) => TEKS.exec(run)?.[2] ?? null);
  if (!teks.some((t) => t !== null && terbuka(t) > 0)) return paragraf;

  const hasil = [...runs];
  let digabung = false;

  for (let i = 0; i < hasil.length; i++) {
    const isi = TEKS.exec(hasil[i]);
    if (!isi || terbuka(isi[2]) <= 0) continue;

    let gabungan = isi[2];
    let j = i + 1;

    while (j < hasil.length && terbuka(gabungan) > 0) {
      const lanjutan = TEKS.exec(hasil[j]);
      if (!lanjutan) break;

      gabungan += lanjutan[2];
      hasil[j] = hasil[j].replace(TEKS, `$1$3`);
      j += 1;
    }

    if (gabungan !== isi[2]) {
      hasil[i] = hasil[i].replace(
        TEKS,
        (_cocok, buka) => `${buka.includes("xml:space") ? buka : buka.replace(/>$/, ' xml:space="preserve">')}${gabungan}</w:t>`
      );
      digabung = true;
    }
  }

  if (!digabung) return paragraf;

  let ke = 0;
  return paragraf.replace(RUN, () => hasil[ke++]);
}

const document = await zip.file("word/document.xml").async("string");
let jumlah = 0;

const rapi = document.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (paragraf) => {
  const hasil = rapikanParagraf(paragraf);
  if (hasil !== paragraf) jumlah += 1;
  return hasil;
});

zip.file("word/document.xml", rapi);

mkdirSync(tujuan, { recursive: true });
writeFileSync(
  join(tujuan, "riplay_personal_msl.docx"),
  await zip.generateAsync({ type: "nodebuffer" })
);

console.log(`riplay: template -> public/riplay/riplay_personal_msl.docx (${jumlah} paragraf dirapikan)`);
