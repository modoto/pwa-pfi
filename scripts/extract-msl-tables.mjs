/**
 * Ekstrak tabel tarif dan asumsi produk dari src/calculators/MSL.xlsm menjadi
 * src/lib/calc/msl-tables.ts.
 *
 * Workbook-nya tetap sumber kebenaran; berkas TypeScript-nya hasil turunan dan
 * ikut di-commit supaya aplikasi tidak perlu membaca .xlsm saat runtime.
 * Jalankan ulang dengan `npm run msl:tables` setiap kali workbook diperbarui.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const zip = await JSZip.loadAsync(readFileSync(join(root, "src", "calculators", "MSL.xlsm")));
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

// COICOR_Tab = COI_COR_Table!B3:G102 — baris 4..102 berisi usia 1..99.
const coiRows = [];
for (let row = 4; row <= 102; row++) {
  const age = num(coi, `B${row}`);
  if (!age) continue;
  coiRows.push([
    age,
    num(coi, `C${row}`),
    num(coi, `D${row}`),
    num(coi, `E${row}`),
    num(coi, `F${row}`),
    num(coi, `G${row}`),
  ]);
}

// PAA_Tab = J3:M102 dan PAAB_Tab = P3:S102; dicari HLOOKUP(OC, tab, usia + 1).
const paa = [];
const paab = [];
for (let age = 1; age <= 99; age++) {
  const row = 3 + age;
  paa.push([num(coi, `J${row}`), num(coi, `K${row}`), num(coi, `L${row}`), num(coi, `M${row}`)]);
  paab.push([num(coi, `P${row}`), num(coi, `Q${row}`), num(coi, `R${row}`), num(coi, `S${row}`)]);
}

// MPP_Tab = U3:AS50 (usia PP di kolom U, kolom ke-(usia tertanggung + 1))
// MSP_Tab = AU3:CK50 (usia PP di kolom AU, kolom ke-(usia tertanggung - 16))
const kolomKe = (start, offset) => {
  let n = 0;
  for (const ch of start) n = n * 26 + (ch.charCodeAt(0) - 64);
  n += offset;
  let out = '';
  while (n > 0) {
    const sisa = (n - 1) % 26;
    out = String.fromCharCode(65 + sisa) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};

function payorTable(kolomUsia, kolomPertama, jumlahKolom) {
  const rows = [];
  for (let row = 4; row <= 50; row++) {
    const usia = num(coi, kolomUsia + row);
    if (!usia) continue;
    const tarif = [];
    for (let i = 0; i < jumlahKolom; i++) tarif.push(num(coi, kolomKe(kolomPertama, i) + row));
    rows.push([usia, ...tarif]);
  }
  return rows;
}

const mpp = payorTable('U', 'V', 24);
const msp = payorTable('AU', 'AV', 42);

const kolom = (map, col, from, to) => {
  const out = [];
  for (let row = from; row <= to; row++) out.push(num(map, `${col}${row}`));
  return out;
};

const assumptions = {
  coverageAge: num(asum, "E5"),
  entryAgeInsured: [num(asum, "E7"), num(asum, "F7")],
  entryAgePolicyHolder: [num(asum, "E8"), num(asum, "F8")],
  premiumLoading: kolom(asum, "F", 11, 13),
  topUpAllocation: num(asum, "E15"),
  adminFeePerMonth: num(asum, "E17"),
  fundManagementFee: num(asum, "E18"),
  surrenderCharge: kolom(asum, "F", 20, 27),
  deathBenefit: kolom(asum, "F", 38, 47),
  loyaltyBonus: kolom(asum, "F", 51, 61),
  maintenanceFee: kolom(asum, "F", 65, 72),
  saMultiplier: Array.from({ length: 12 }, (_, i) => [
    num(asum, `H${5 + i}`),
    num(asum, `I${5 + i}`),
    num(asum, `J${5 + i}`),
  ]),
  funds: Array.from({ length: 4 }, (_, i) => ({
    nama: asum.get(`C${31 + i}`),
    negatif: num(asum, `E${31 + i}`),
    nol: num(asum, `F${31 + i}`),
    positif: num(asum, `G${31 + i}`),
  })),
};

const angka = (n) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(8))));

const out = `/**
 * Tabel tarif dan asumsi produk Mega Signature Link.
 *
 * DIHASILKAN OTOMATIS dari src/calculators/MSL.xlsm oleh
 * scripts/extract-msl-tables.mjs — jangan disunting tangan.
 * Perbarui dengan \`npm run msl:tables\` bila workbook-nya berubah.
 */

/** [usia, COI dasar, CI Plus, HCP, HCP Plus, WP] — tarif per 1 satuan UP. */
export const COI_COR: readonly (readonly number[])[] = [
${coiRows.map((r) => `  [${r.map(angka).join(", ")}],`).join("\n")}
];

/** Tarif Mega PA A per usia (indeks 0 = usia 1), kolom = occupational class 1–4. */
export const PAA_RATES: readonly (readonly number[])[] = [
${paa.map((r) => `  [${r.map(angka).join(", ")}],`).join("\n")}
];

/** Tarif Mega PA AB per usia (indeks 0 = usia 1), kolom = occupational class 1–4. */
export const PAAB_RATES: readonly (readonly number[])[] = [
${paab.map((r) => `  [${r.map(angka).join(", ")}],`).join("\n")}
];

/** Tarif Mega Spouse Payor: [usia pemegang polis, tarif untuk usia tertanggung 18..59]. */
export const MSP_RATES: readonly (readonly number[])[] = [
${msp.map((r) => `  [${r.map(angka).join(", ")}],`).join("\n")}
];

/** Tarif Mega Parent Payor: [usia pemegang polis, tarif untuk usia tertanggung 1..24]. */
export const MPP_RATES: readonly (readonly number[])[] = [
${mpp.map((r) => `  [${r.map(angka).join(", ")}],`).join("\n")}
];

export const MSL_ASSUMPTIONS = ${JSON.stringify(assumptions, null, 2)} as const;
`;

writeFileSync(join(root, "src", "lib", "calc", "msl-tables.ts"), out, "utf8");
console.log(`tabel MSL -> src/lib/calc/msl-tables.ts (${coiRows.length} baris COI)`);
