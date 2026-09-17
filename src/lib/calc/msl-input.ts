"use client";

/**
 * Menyusun masukan mesin proyeksi dari isian langkah-langkah Sales Illustration.
 *
 * Beberapa hal di formulir belum punya padanan pasti di MSL.xlsm; semuanya
 * ditandai di bawah supaya mudah dikoreksi begitu tim bisnis mengonfirmasi.
 */

import { MSL_ASSUMPTIONS } from "./msl-tables";
import type { MslInput, MslRiders } from "./msl-engine";
import { FUND_CODE_TO_WORKBOOK_INDEX, LEGACY_FUND_NAMES } from "@/lib/investment-data";
import { hitungUsia } from "@/lib/lead-form-data";
import { ridersTerpilih } from "@/lib/rider-data";

export type IllustrationSteps = {
  policyHolder: Record<string, string>;
  product: Record<string, string>;
  rider: Record<string, string>;
  investment: Record<string, string>;
};

const angka = (nilai: string | undefined) => Number(String(nilai ?? "").replace(/\D/g, "")) || 0;

/** "20 Tahun" → 20; "Sampai Usia 65 Tahun" → sisa tahun sampai usia itu. */
function lamaTahun(teks: string, usia: number): number {
  const sampaiUsia = /usia\s+(\d+)/i.exec(teks);
  if (sampaiUsia) return Math.max(Number(sampaiUsia[1]) - usia, 0);

  const tahun = /(\d+)/.exec(teks);
  return tahun ? Number(tahun[1]) : 0;
}

type Entry = { tahun: string; jumlah: string };

function bacaEntries(raw: string | undefined): { year: number; amount: number }[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return (parsed as Entry[])
      .map((item) => ({ year: Number(item?.tahun) || 0, amount: angka(item?.jumlah) }))
      .filter((item) => item.year > 0 && item.amount > 0);
  } catch {
    return [];
  }
}

function bacaAlokasi(raw: string | undefined): number[] {
  const porsi = MSL_ASSUMPTIONS.funds.map(() => 0);
  if (!raw) return porsi;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return porsi;

    for (const item of parsed as { code?: string; fund?: string; persen?: number }[]) {
      // Dicocokkan lewat kode dana dari master, bukan nama: ejaan nama di
      // master ("Balance", "Fix Income") berbeda dengan workbook. Alokasi lama
      // yang tersimpan sebelum ada kode dicocokkan lewat nama lamanya.
      const index =
        item.code !== undefined
          ? (FUND_CODE_TO_WORKBOOK_INDEX[item.code] ?? -1)
          : LEGACY_FUND_NAMES.indexOf((item.fund ?? "") as (typeof LEGACY_FUND_NAMES)[number]);

      if (index >= 0) porsi[index] = (Number(item.persen) || 0) / 100;
    }
  } catch {
    return porsi;
  }

  return porsi;
}

/** Rider yang dipilih agen tapi belum punya padanan tarif di workbook. */
export function riderTanpaTarif(rider: Record<string, string>): string[] {
  return ridersTerpilih(rider)
    .filter((item) => item.mesin === null)
    .map((item) => item.nama);
}

/** Rider terpilih dalam bentuk masukan mesin (padanan lewat `RIDER_CODE_TO_ENGINE`). */
export function buildMslRiders(rider: Record<string, string>): MslRiders {
  const riders: MslRiders = {};

  for (const item of ridersTerpilih(rider)) {
    const target = item.mesin;
    if (!target) continue;

    const up = angka(item.up);
    if (target === "wp" || target === "spousePayor" || target === "parentPayor") {
      riders[target] = true;
    } else if (target === "paa" || target === "paab") {
      // Occupational class belum ditanyakan di formulir; sementara kelas 1.
      riders[target] = { sumAssured: up, occupationalClass: 1 };
    } else {
      riders[target] = up;
    }
  }

  return riders;
}

export function buildMslInput(steps: IllustrationSteps): MslInput | null {
  const { policyHolder, product, rider, investment } = steps;

  // Untuk tujuan "Keluarga"/"Perusahaan" tertanggungnya orang lain.
  const tanggalTertanggung = policyHolder.ct_tanggal_lahir || policyHolder.tanggal_lahir || "";
  const insuredAge = Number(hitungUsia(tanggalTertanggung)) || 0;
  const policyHolderAge = Number(hitungUsia(policyHolder.tanggal_lahir ?? "")) || insuredAge;

  const basicPremium = angka(product.premi_dasar);
  const sumAssured = angka(product.uang_pertanggungan);
  if (!insuredAge || !basicPremium || !sumAssured) return null;

  const premiumTermYears =
    lamaTahun(product.masa_pembayaran ?? "", insuredAge) ||
    lamaTahun(product.masa_pertanggungan ?? "", insuredAge);
  const coverageYears = lamaTahun(product.masa_pertanggungan ?? "", insuredAge);

  // Formulir mencatat Top Up Berkala per tahun polis (tahun + jumlah),
  // sedangkan workbook memodelkannya sebagai jumlah tetap tiap tahun selama
  // masa bayar — perlu dikonfirmasi mana yang dimaksud. Keduanya masuk ke dana
  // top up dengan perlakuan yang sama, jadi dipisah hanya agar kolom "Top Up
  // Berkala" dan "Top Up Sekaligus" di Kutipan Ilustrasi jujur.
  const berkala = bacaEntries(product.top_up_berkala);

  const topUps: { year: number; amount: number }[] = [];
  const tunggalTahun = Number(product.top_up_tunggal_tahun) || 0;
  const tunggalJumlah = angka(product.top_up_tunggal_jumlah);
  if (tunggalTahun > 0 && tunggalJumlah > 0) {
    topUps.push({ year: tunggalTahun, amount: tunggalJumlah });
  }

  const riders = buildMslRiders(rider);

  // Jenis kelamin tertanggung; tarif COI MAML dibedakan pria/wanita.
  const kelamin = policyHolder.ct_nama_depan ? policyHolder.ct_jenis_kelamin : policyHolder.jenis_kelamin;

  return {
    insuredAge,
    insuredSex: /perempuan|wanita|female/i.test(kelamin ?? "") ? "Female" : "Male",
    policyHolderAge,
    coverageYears: coverageYears || undefined,
    premiumTermYears: premiumTermYears || coverageYears || 1,
    basicPremium,
    regularTopUp: 0,
    regularTopUps: berkala,
    sumAssured,
    allocations: bacaAlokasi(investment.alokasi),
    singleTopUps: topUps,
    withdrawals: bacaEntries(product.penarikan),
    riders,
  };
}
