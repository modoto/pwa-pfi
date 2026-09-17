/**
 * Ekstrak tabel persentase manfaat tahapan dari src/calculators/MSP.xlsm dan
 * MAMS.xlsm menjadi src/lib/calc/rop-tables.ts.
 *
 * Kedua produk memakai susunan sheet dan rumus yang sama, dan per 2026-09-17
 * isi tabelnya pun identik — tetap disimpan terpisah per produk supaya
 * perbedaan tarif di kemudian hari langsung terlihat.
 *
 * Yang diambil dari sheet `ROP_Rates`:
 *
 * - bayar bulanan  `G5:M41`  (kolom: usia bawah, usia atas, masa asuransi,
 *   lalu tarif untuk masa bayar 7, 8, 9, 10)
 * - bayar tahunan  `O5:U41`
 *
 * Sel kosong berarti kombinasi masa asuransi × masa bayar itu tidak dijual.
 *
 * Jalankan ulang dengan `npm run rop:tables` bila workbook-nya diperbarui.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Masa bayar yang punya kolom tarif di workbook. */
const MASA_BAYAR = [7, 8, 9, 10];

const WORKBOOK = { msp: "MSP.xlsm", mams: "MAMS.xlsm" };

/** Nama kolom Excel `offset` langkah di kanan `awal`. */
function kolomKe(awal, offset) {
  let n = 0;
  for (const ch of awal) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += offset;

  let out = "";
  while (n > 0) {
    const sisa = (n - 1) % 26;
    out = String.fromCharCode(65 + sisa) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Peta referensi sel → angka untuk satu sheet. */
async function cells(zip, sheetName) {
  const read = async (p) => zip.file(p).async("string");

  const rels = Object.fromEntries(
    [...(await read("xl/_rels/workbook.xml.rels")).matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(
      (m) => [m[1], m[2]]
    )
  );
  const berkas = [
    ...(await read("xl/workbook.xml")).matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g),
  ].find((m) => m[1] === sheetName);

  const xml = await read("xl/" + rels[berkas[2]].replace(/^\/?xl\//, ""));
  const map = new Map();

  for (const c of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, ref, attrs, body = ""] = c;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    if (raw === undefined || (type && type !== "n")) continue;
    map.set(ref, Number(raw));
  }

  return map;
}

/** Satu tabel tarif mulai dari kolom `kolomPertama` (usia bawah). */
function baca(rop, kolomPertama) {
  const rows = [];

  for (let row = 6; row <= 41; row++) {
    const ageLb = rop.get(kolomKe(kolomPertama, 0) + row);
    if (ageLb === undefined) continue;

    const rates = {};
    MASA_BAYAR.forEach((masa, i) => {
      const nilai = rop.get(kolomKe(kolomPertama, 3 + i) + row);
      // MSP.xlsm menyimpan sebagian tarif dengan derau floating point
      // (1,1500000000000001); dibulatkan supaya sama dengan MAMS.xlsm.
      if (nilai !== undefined) rates[masa] = Math.round(nilai * 1e6) / 1e6;
    });

    rows.push({
      ageLb,
      ageUb: rop.get(kolomKe(kolomPertama, 1) + row) ?? 0,
      policyTerm: rop.get(kolomKe(kolomPertama, 2) + row) ?? 0,
      rates,
    });
  }

  return rows;
}

const tables = {};
for (const [produk, berkas] of Object.entries(WORKBOOK)) {
  const zip = await JSZip.loadAsync(readFileSync(join(root, "src", "calculators", berkas)));
  const rop = await cells(zip, "ROP_Rates");
  tables[produk] = { Monthly: baca(rop, "G"), Yearly: baca(rop, "O") };
}

const out = `/**
 * Tabel persentase manfaat tahapan Mega Saving Protection (MSP) dan
 * Mega Asuransi Maksima Solusi (MAMS).
 *
 * DIHASILKAN OTOMATIS dari src/calculators/MSP.xlsm dan MAMS.xlsm oleh
 * scripts/extract-rop-tables.mjs — jangan disunting tangan.
 * Perbarui dengan \`npm run rop:tables\` bila workbook-nya berubah.
 *
 * \`rates\` dikunci masa pembayaran premi (7–10 tahun); kombinasi yang tidak
 * ada berarti tidak dijual untuk masa asuransi itu.
 */

export const ROP_RATES = ${JSON.stringify(tables)} as const;
`;

writeFileSync(join(root, "src", "lib", "calc", "rop-tables.ts"), out, "utf8");

const sama =
  JSON.stringify(tables.msp) === JSON.stringify(tables.mams) ? "identik" : "BERBEDA";
console.log(
  `tabel ROP -> src/lib/calc/rop-tables.ts (MSP ${tables.msp.Yearly.length} baris, MAMS ${tables.mams.Yearly.length} baris; isi kedua produk ${sama})`
);
