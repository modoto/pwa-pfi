/**
 * Ekstrak tabel tarif Mega Asuransi Maksima Edukasi dari
 * src/calculators/MAME.xlsx menjadi src/lib/calc/mame-tables.ts.
 *
 * Workbook ini tampaknya ekspor Google Sheets: rumusnya memanggil tabel
 * bernama `MaturityRate_Yearly` / `CVRate_Monthly`, tapi di berkasnya tabel
 * itu bernama `Table_5`, `Table_6`, … sehingga Excel menampilkan #N/A. Isi
 * tabelnya utuh, jadi diambil langsung dari rentang selnya:
 *
 * - Maturity_Table!G5:K15  tarif beasiswa bayar bulanan (masa bayar 2, 3)
 * - Maturity_Table!M5:R15  tarif beasiswa bayar tahunan (masa bayar 1, 2, 3)
 * - CV_Table!F10:AT418     faktor nilai tunai bayar bulanan, per bulan polis × usia 18..55
 * - CV_Table!AV10:CJ622    faktor nilai tunai bayar tahunan
 *
 * Sheet "Yearly Basis Calc" hanya membaca bulan ke-12, 24, …, jadi nilai
 * tunai yang disimpan cukup titik akhir tahun polis (dibulatkan 2 desimal
 * seperti ROUND(…, 2) di CV_Table!C11).
 *
 * Jalankan ulang dengan `npm run mame:tables` setiap kali workbook diperbarui.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const zip = await JSZip.loadAsync(readFileSync(join(root, "src", "calculators", "MAME.xlsx")));
const read = async (p) => zip.file(p).async("string");

const rels = Object.fromEntries(
  [...(await read("xl/_rels/workbook.xml.rels")).matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(
    (m) => [m[1], m[2]]
  )
);
const sheetFiles = Object.fromEntries(
  [...(await read("xl/workbook.xml")).matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(
    (m) => [m[1], rels[m[2]].replace(/^\/?xl\//, "")]
  )
);

/** Peta referensi sel → angka (sel bukan angka diabaikan). */
async function cells(sheetName) {
  const xml = await read("xl/" + sheetFiles[sheetName]);
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

const kolomKe = (start, offset) => {
  let n = 0;
  for (const ch of start) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += offset;
  let out = "";
  while (n > 0) {
    const sisa = (n - 1) % 26;
    out = String.fromCharCode(65 + sisa) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

const maturity = await cells("Maturity_Table");
const cv = await cells("CV_Table");

/** Baris tarif beasiswa: [usia bawah, usia atas, masa asuransi, tarif per masa bayar…]. */
function maturityRows(kolomPertama, masaBayar) {
  const rows = [];
  for (let row = 6; row <= 15; row++) {
    const lb = maturity.get(kolomKe(kolomPertama, 0) + row);
    if (lb === undefined) continue;
    const tarif = Object.fromEntries(
      masaBayar.map((masa, i) => [masa, maturity.get(kolomKe(kolomPertama, 3 + i) + row) ?? 0])
    );
    rows.push({
      ageLb: lb,
      ageUb: maturity.get(kolomKe(kolomPertama, 1) + row),
      policyTerm: maturity.get(kolomKe(kolomPertama, 2) + row),
      rates: tarif,
    });
  }
  return rows;
}

/**
 * Faktor nilai tunai akhir tahun: kunci "masaAsuransi-masaBayar", isi
 * [tahun polis 1..n][usia 18..55].
 */
function cvRows(kolomPertama, dari, sampai) {
  const out = {};
  for (let row = dari; row <= sampai; row++) {
    const term = cv.get(kolomKe(kolomPertama, 0) + row);
    const prem = cv.get(kolomKe(kolomPertama, 1) + row);
    const month = cv.get(kolomKe(kolomPertama, 2) + row);
    if (term === undefined || month === undefined || month % 12 !== 0) continue;
    const kunci = `${term}-${prem}`;
    out[kunci] ??= [];
    out[kunci][month / 12 - 1] = Array.from({ length: 38 }, (_, i) =>
      Math.round((cv.get(kolomKe(kolomPertama, 3 + i) + row) ?? 0) * 100) / 100
    );
  }
  return out;
}

const tables = {
  maturity: {
    Monthly: maturityRows("G", [2, 3]),
    Yearly: maturityRows("M", [1, 2, 3]),
  },
  cashValueFirstAge: 18,
  cashValue: {
    Monthly: cvRows("F", 11, 418),
    Yearly: cvRows("AV", 11, 622),
  },
};

const out = `/**
 * Tabel tarif Mega Asuransi Maksima Edukasi (MAME).
 *
 * DIHASILKAN OTOMATIS dari src/calculators/MAME.xlsx oleh
 * scripts/extract-mame-tables.mjs — jangan disunting tangan.
 * Perbarui dengan \`npm run mame:tables\` bila workbook-nya berubah.
 */

export const MAME_TABLES = ${JSON.stringify(tables)} as const;
`;

writeFileSync(join(root, "src", "lib", "calc", "mame-tables.ts"), out, "utf8");
const jumlah = (obj) => Object.entries(obj).map(([k, v]) => `${k}:${v.length}th`).join(" ");
console.log(
  `tabel MAME -> src/lib/calc/mame-tables.ts (beasiswa ${tables.maturity.Monthly.length}+${tables.maturity.Yearly.length} baris; NT bulanan ${jumlah(tables.cashValue.Monthly)}; NT tahunan ${jumlah(tables.cashValue.Yearly)})`
);
