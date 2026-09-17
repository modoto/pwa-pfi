/**
 * Mesin proyeksi ilustrasi Mega Asuransi Maksima Link (MAML).
 *
 * Terjemahan sheet `Calc_Annual` dan `output` pada src/calculators/MAML.xlsm.
 * Kerangkanya sama dengan Mega Signature Link (msl-engine.ts), tapi tarif,
 * asumsi, dan beberapa aturannya berbeda:
 *
 * - COI dasar per 1000 UP, dibedakan pria/wanita, dibulatkan ke rupiah.
 * - Tiap rider dihitung per 1000 dan dibulatkan; rider hanya berlaku bila
 *   usia masuk memenuhi syarat, dan sekali biayanya nol (mis. WP selepas masa
 *   bayar, payor selepas usia tabel) tidak muncul lagi.
 * - Biaya akuisisi 40% / 20% / 10% / 0% untuk tahun 1, 2, 3, 4+.
 * - Nilai dana per dana investasi dibulatkan sebelum dijumlahkan.
 *
 * Porsi penarikan yang diambil dari dana top up dihitung dari saldo top up
 * skenario **negatif** untuk ketiga skenario — begitu rumus `DO` di workbook.
 */

import { MAML_ASSUMPTIONS, MAML_COI, MAML_PAA, MAML_PAB, MAML_PP, MAML_SP } from "./maml-tables";
import {
  SCENARIOS,
  jumlahTahun,
  type MslInput,
  type MslProjection,
  type MslRiderKey,
  type MslScenarioYear,
  type MslYear,
  type Scenario,
} from "./msl-engine";

const A = MAML_ASSUMPTIONS;

/** Nilai tabel ke-n (1-based) dengan indeks dibatasi panjang tabel, seperti INDEX(…, MIN(n, len)). */
const pada = (table: readonly number[], n: number) =>
  table[Math.min(Math.max(n, 1), table.length) - 1] ?? 0;

/** VLOOKUP(usia, tabel per usia 1..99, kolom) — di luar tabel = #N/A → 0 lewat IFERROR. */
const perUsia = (table: readonly (readonly number[])[], age: number, kolom: number) =>
  age >= 1 && age <= table.length ? (table[age - 1]?.[kolom] ?? 0) : 0;

/**
 * VLOOKUP(usia PP, tabel payor, kolom) — baris tabel [usia PP, tarif…].
 * Kolom 1 mengembalikan usia PP itu sendiri, persis seperti workbook.
 */
function payor(table: readonly (readonly number[])[], phAge: number, kolom: number): number {
  const row = table.find((item) => item[0] === phAge);
  if (!row || kolom < 1 || kolom > row.length) return 0;
  return row[kolom - 1] ?? 0;
}

const bulat = (nilai: number) => Math.round(nilai);

function scenarioReturn(fundIndex: number, scenario: Scenario): number {
  const fund = A.funds[fundIndex];
  if (!fund) return 0;
  return scenario === "negatif" ? fund.negatif : scenario === "nol" ? fund.nol : fund.positif;
}

/** Biaya tiap rider pada satu tahun polis, sebelum aturan "sekali nol tetap nol". */
function riderCostsRaw(
  input: MslInput,
  age: number,
  phAge: number,
  policyYear: number
): Partial<Record<MslRiderKey, number>> {
  const r = input.riders ?? {};
  const em = input.extraMortality ?? {};
  const entry = input.insuredAge;
  const phEntry = input.policyHolderAge ?? input.insuredAge;
  const totalPremi = input.basicPremium + (input.regularTopUp ?? 0);
  const phOk = phEntry >= 18 && phEntry <= 64;
  const biaya: Partial<Record<MslRiderKey, number>> = {};

  if (r.paa && entry >= 18 && entry <= 64) {
    biaya.paa = bulat(
      (perUsia(MAML_PAA, age, (r.paa.occupationalClass ?? 1) - 1) * r.paa.sumAssured) / 1000 *
        (1 + (em.paa ?? 0))
    );
  }
  if (r.paab && entry >= 18 && entry <= 64) {
    biaya.paab = bulat(
      (perUsia(MAML_PAB, age, (r.paab.occupationalClass ?? 1) - 1) * r.paab.sumAssured) / 1000 *
        (1 + (em.paab ?? 0))
    );
  }
  if (r.ciPlus && entry <= 84) {
    biaya.ciPlus = bulat((perUsia(MAML_COI, age, 3) * r.ciPlus) / 1000 * (1 + (em.ciPlus ?? 0)));
  }
  if (r.hcp && entry <= 59) {
    biaya.hcp = bulat((perUsia(MAML_COI, age, 4) * r.hcp) / 1000 * (1 + (em.hcp ?? 0)));
  }
  if (r.hcpPlus && entry <= 59) {
    biaya.hcpPlus = bulat((perUsia(MAML_COI, age, 5) * r.hcpPlus) / 1000 * (1 + (em.hcpPlus ?? 0)));
  }
  if (r.wp && entry >= 18 && entry <= 64 && policyYear <= input.premiumTermYears) {
    biaya.wp = bulat(
      (perUsia(MAML_COI, age, 2) * input.basicPremium) / 1000 * (1 + (em.wp ?? 0))
    );
  }
  if (r.spousePayor && phOk) {
    biaya.spousePayor = bulat(
      (payor(MAML_SP, phAge, age - 16) * totalPremi) / 1000 * (1 + (em.spousePayor ?? 0))
    );
  }
  if (r.parentPayor && phOk) {
    biaya.parentPayor = bulat(
      (payor(MAML_PP, phAge, age + 1) * totalPremi) / 1000 * (1 + (em.parentPayor ?? 0))
    );
  }

  return biaya;
}

type FundState = { basic: number; topUp: number };

/** Proyeksi MAML; bentuk hasilnya sama dengan `projectMsl`. */
export function projectMaml(input: MslInput): MslProjection {
  const coverage =
    input.coverageYears && input.coverageYears > 0
      ? input.coverageYears
      : Math.max(A.coverageAge - input.insuredAge, 0);

  const allocations = A.funds.map((_, index) => input.allocations[index] ?? 0);
  const singleTopUps = input.singleTopUps ?? [];
  const regularTopUps = input.regularTopUps ?? [];
  const withdrawals = input.withdrawals ?? [];
  const pria = input.insuredSex !== "Female";
  const phEntry = input.policyHolderAge ?? input.insuredAge;

  const state: Record<Scenario, FundState[]> = {
    negatif: A.funds.map(() => ({ basic: 0, topUp: 0 })),
    nol: A.funds.map(() => ({ basic: 0, topUp: 0 })),
    positif: A.funds.map(() => ({ basic: 0, topUp: 0 })),
  };

  const years: MslYear[] = [];
  let accumulated = 0;
  let tarikanDasarKumulatif = 0;
  // Rider yang biayanya sudah pernah nol tidak ditagih lagi (IF(AND(B>1, prev=0), 0, …)).
  const riderLalu: Partial<Record<MslRiderKey, number>> = {};

  for (let policyYear = 1; policyYear <= coverage; policyYear++) {
    const age = input.insuredAge + policyYear - 1;
    const phAge = phEntry + policyYear - 1;
    const bayarPremi = policyYear <= input.premiumTermYears;

    const basicPremium = bayarPremi ? input.basicPremium : 0;
    const regularTopUp =
      (bayarPremi ? (input.regularTopUp ?? 0) : 0) + jumlahTahun(regularTopUps, policyYear);
    const singleTopUp = singleTopUps
      .filter((item) => item.year === policyYear)
      .reduce((jumlah, item) => jumlah + item.amount, 0);
    const withdrawal = withdrawals
      .filter((item) => item.year === policyYear)
      .reduce((jumlah, item) => jumlah + item.amount, 0);

    accumulated += basicPremium + regularTopUp + singleTopUp - withdrawal;

    const acquisition = basicPremium * pada(A.acquisitionCost, policyYear);
    const regularTopUpLoading = regularTopUp * A.topUpAllocation;
    const singleTopUpLoading = singleTopUp * A.topUpAllocation;
    const adminFee = A.adminFeePerMonth * 12;
    const maintenance = pada(A.maintenanceFee, policyYear);

    const coiBasic = bulat(
      (perUsia(MAML_COI, age, pria ? 0 : 1) * input.sumAssured) / 1000 *
        (1 + (input.extraMortality?.basic ?? 0))
    );

    const mentah = riderCostsRaw(input, age, phAge, policyYear);
    const riderCosts: Partial<Record<MslRiderKey, number>> = {};
    for (const key of Object.keys(input.riders ?? {}) as MslRiderKey[]) {
      const nilai = policyYear > 1 && !riderLalu[key] ? 0 : (mentah[key] ?? 0);
      riderLalu[key] = nilai;
      if (nilai) riderCosts[key] = nilai;
    }
    const coiRiders = Object.values(riderCosts).reduce((jumlah, nilai) => jumlah + (nilai ?? 0), 0);

    // Penarikan diambil dari dana top up (saldo skenario negatif) lebih dulu.
    const topUpNegatif = state.negatif.reduce((jumlah, fund) => jumlah + fund.topUp, 0);
    const dariTopUp = Math.max(
      Math.min(
        topUpNegatif + regularTopUp + singleTopUp - regularTopUpLoading - singleTopUpLoading,
        withdrawal
      ),
      0
    );
    const dariDasar = withdrawal - dariTopUp;
    tarikanDasarKumulatif += dariDasar;

    const loyaltyBonus =
      tarikanDasarKumulatif > 0 || !bayarPremi
        ? 0
        : pada(A.loyaltyBonus, policyYear) * input.basicPremium;

    const dbFactor = pada(A.deathBenefit, Math.min(age, 10));
    const netAmountAtRisk = input.sumAssured * dbFactor;

    const scenarios = {} as Record<Scenario, MslScenarioYear>;

    for (const scenario of SCENARIOS) {
      let fundStart = 0;
      let fundEnd = 0;
      let surrenderValue = 0;
      const charge = pada(A.surrenderCharge, policyYear);

      state[scenario].forEach((fund, index) => {
        const porsi = allocations[index];
        const tumbuh = Math.sqrt(1 + scenarioReturn(index, scenario));

        const basicAwal =
          (fund.basic + (basicPremium - acquisition) * porsi) * tumbuh -
          (coiBasic + coiRiders + adminFee + dariDasar) * porsi -
          A.fundManagementFee * porsi * fund.basic;
        const basicAkhir = (basicAwal - maintenance * basicAwal) * tumbuh + loyaltyBonus * porsi;

        const topUpAwal =
          (fund.topUp +
            (regularTopUp + singleTopUp - singleTopUpLoading - regularTopUpLoading - dariTopUp) *
              porsi) *
          tumbuh;
        const topUpAkhir = topUpAwal * tumbuh;

        fund.basic = basicAkhir;
        fund.topUp = topUpAkhir;

        // Output workbook menjumlahkan nilai per dana yang sudah dibulatkan.
        fundStart += bulat(basicAwal + topUpAwal);
        fundEnd += bulat(basicAkhir + topUpAkhir);
        surrenderValue += (1 - charge) * basicAkhir + topUpAkhir;
      });

      scenarios[scenario] = {
        fundStart,
        fundEnd,
        // Faktor santunan dipakai dua kali, persis seperti output!X workbook.
        deathBenefit: dbFactor * netAmountAtRisk + fundEnd,
        surrenderValue,
      };
    }

    years.push({
      policyYear,
      insuredAge: age,
      basicPremium,
      regularTopUp,
      singleTopUp,
      withdrawal,
      accumulatedPremium: accumulated,
      loyaltyBonus,
      coiBasic,
      coiRiders,
      riderCosts,
      premiumLoading: acquisition + regularTopUpLoading + singleTopUpLoading,
      adminFee,
      netAmountAtRisk,
      scenarios,
    });
  }

  return {
    years,
    funds: A.funds
      .map((fund, index) => ({ name: fund.nama, portion: allocations[index] }))
      .filter((fund) => fund.portion > 0),
  };
}
