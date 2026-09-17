/**
 * Ekstrak tabel tarif dan asumsi Mega Asuransi Maksima Link dari
 * src/calculators/MAML.xlsm menjadi src/lib/calc/maml-tables.ts.
 *
 * Workbook-nya tetap sumber kebenaran; berkas TypeScript-nya hasil turunan dan
 * ikut di-commit supaya aplikasi tidak perlu membaca .xlsm saat runtime.
 * Jalankan ulang dengan `npm run maml:tables` setiap kali workbook diperbarui.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const zip = await JSZip.loadAsync(readFileSync(join(root, "src", "calculators", "MAML.xlsm")));
const read = async (p) => zip.file(p).async("string");

const sharedStrings = [...(await read("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(
  (m) => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")
);

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

/** Peta referensi sel → nilai, hanya sel berisi. */
async function cells(sheetName) {
  const xml = await read("xl/" + sheetFiles[sheetName]);
  const map = new Map();

  for (const c of xml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, ref, attrs, body = ""] = c;
    const type = /t="([^"]+)"/.exec(attrs)?.[1];
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    if (raw === undefined) continue;
    map.set(ref, type === "s" ? sharedStrings[Number(raw)] : Number(raw));
  }

  return map;
}

const coi = await cells("COI_COR_Table");
const asum = await cells("Assumption");

const num = (map, ref) => {
  const value = map.get(ref);
  return typeof value === "number" ? value : 0;
};

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

// COI_COR_Table!B4:H102 — usia 1..99; kolom: COI pria, COI wanita, WP, CIP,
// HCP, HCP Plus. Semua tarif per 1000 (UP, premi, atau manfaat harian).
const coiRows = [];
for (let row = 4; row <= 102; row++) {
  const age = num(coi, `B${row}`);
  if (!age) continue;
  coiRows.push(["C", "D", "E", "F", "G", "H"].map((col) => num(coi, `${col}${row}`)));
}

// PA Risiko A = J3:N102 dan PA Risiko AB = P3:T102; kolom = OCC 1..4, per 1000 UP.
const paa = [];
const pab = [];
for (let row = 4; row <= 102; row++) {
  paa.push(["K", "L", "M", "N"].map((col) => num(coi, `${col}${row}`)));
  pab.push(["Q", "R", "S", "T"].map((col) => num(coi, `${col}${row}`)));
}

/** Tabel payor: baris = usia pemegang polis (kolom pertama), kolom = usia tertanggung. */
function payorTable(kolomUsia, kolomPertama, jumlahKolom, dari, sampai) {
  const rows = [];
  for (let row = dari; row <= sampai; row++) {
    const usia = num(coi, kolomUsia + row);
    if (!usia) continue;
    const tarif = [];
    for (let i = 0; i < jumlahKolom; i++) tarif.push(num(coi, kolomKe(kolomPertama, i) + row));
    rows.push([usia, ...tarif]);
  }
  return rows;
}

// Parent Payor = V6:AT53 (tertanggung usia 1..24); Spouse Payor = AW6:CM52 (usia 18..59).
const pp = payorTable("V", "W", 24, 6, 53);
const sp = payorTable("AW", "AX", 42, 6, 52);

const kolom = (map, col, from, to) => {
  const out = [];
  for (let row = from; row <= to; row++) out.push(num(map, `${col}${row}`));
  return out;
};

const assumptions = {
  coverageAge: num(asum, "E5"),
  entryAgeInsured: [num(asum, "E7"), num(asum, "F7")],
  entryAgePolicyHolder: [num(asum, "E8"), num(asum, "F8")],
  /** Biaya akuisisi tahun polis 1, 2, 3, 4+ (`Acq_Cost`). */
  acquisitionCost: kolom(asum, "F", 11, 14),
  topUpAllocation: num(asum, "E16"),
  adminFeePerMonth: num(asum, "E18"),
  fundManagementFee: num(asum, "E19"),
  /** Tahun polis 1..8; tahun ke-8 dan seterusnya memakai nilai terakhir. */
  surrenderCharge: kolom(asum, "F", 21, 28),
  deathBenefit: kolom(asum, "F", 38, 47),
  loyaltyBonus: kolom(asum, "F", 51, 62),
  maintenanceFee: kolom(asum, "F", 65, 72),
  saMultiplier: Array.from({ length: 11 }, (_, i) => [
    num(asum, `H${5 + i}`),
    num(asum, `I${5 + i}`),
    num(asum, `J${5 + i}`),
  ]),
  funds: Array.from({ length: 4 }, (_, i) => ({
    nama: asum.get(`C${32 + i}`),
    negatif: num(asum, `E${32 + i}`),
    nol: num(asum, `F${32 + i}`),
    positif: num(asum, `G${32 + i}`),
  })),
};

const angka = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(8))));
const tabel = (rows) => rows.map((r) => `  [${r.map(angka).join(", ")}],`).join("\n");

const out = `/**
 * Tabel tarif dan asumsi produk Mega Asuransi Maksima Link (MAML).
 *
 * DIHASILKAN OTOMATIS dari src/calculators/MAML.xlsm oleh
 * scripts/extract-maml-tables.mjs — jangan disunting tangan.
 * Perbarui dengan \`npm run maml:tables\` bila workbook-nya berubah.
 */

/**
 * Per usia (indeks 0 = usia 1): [COI pria, COI wanita, WP, CIP, HCP, HCP Plus].
 * COI dan CIP per 1000 UP, WP per 1000 premi, HCP per 1000 manfaat harian.
 */
export const MAML_COI: readonly (readonly number[])[] = [
${tabel(coiRows)}
];

/** Mega PA Risiko A per usia (indeks 0 = usia 1), kolom = OCC 1–4, per 1000 UP. */
export const MAML_PAA: readonly (readonly number[])[] = [
${tabel(paa)}
];

/** Mega PA Risiko AB per usia (indeks 0 = usia 1), kolom = OCC 1–4, per 1000 UP. */
export const MAML_PAB: readonly (readonly number[])[] = [
${tabel(pab)}
];

/** Mega Parent Payor: [usia pemegang polis, tarif tertanggung usia 1..24], per 1000 premi. */
export const MAML_PP: readonly (readonly number[])[] = [
${tabel(pp)}
];

/** Mega Spouse Payor: [usia pemegang polis, tarif tertanggung usia 18..59], per 1000 premi. */
export const MAML_SP: readonly (readonly number[])[] = [
${tabel(sp)}
];

export const MAML_ASSUMPTIONS = ${JSON.stringify(assumptions, null, 2)} as const;
`;

writeFileSync(join(root, "src", "lib", "calc", "maml-tables.ts"), out, "utf8");
console.log(`tabel MAML -> src/lib/calc/maml-tables.ts (${coiRows.length} baris COI)`);
