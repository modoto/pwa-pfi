/**
 * Mesin proyeksi ilustrasi Mega Signature Link.
 *
 * Terjemahan sheet `Calc_Annual` dan `output` pada src/calculators/MSL.xlsm
 * (lihat docs/kalkulator-ilustrasi.md). Seluruh tarif dan asumsi diambil dari
 * msl-tables.ts yang dihasilkan langsung dari workbook, jadi tidak ada angka
 * produk yang ditulis ulang di sini.
 *
 * Alurnya per tahun polis, per skenario imbal hasil, per dana investasi:
 *
 *   dana dasar  : awal  = (akhir_lalu + (premi - loading) x porsi) x (1+i)^0,5
 *                         - (COI + COI rider + biaya admin + tarikan) x porsi
 *                         - biaya pengelolaan x porsi x akhir_lalu
 *                 akhir = (awal - biaya pemeliharaan x awal) x (1+i)^0,5
 *                         + loyalty bonus x porsi
 *   dana top up : awal  = (akhir_lalu + (top up - alokasi top up - tarikan) x porsi) x (1+i)^0,5
 *                 akhir = awal x (1+i)^0,5
 */

import {
  COI_COR,
  MPP_RATES,
  MSL_ASSUMPTIONS,
  MSP_RATES,
  PAA_RATES,
  PAAB_RATES,
} from "./msl-tables";

export const SCENARIOS = ["negatif", "nol", "positif"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export type OccupationalClass = 1 | 2 | 3 | 4;

export type MslRiders = {
  /** Uang pertanggungan tiap rider; kosong berarti rider tidak diambil. */
  ciPlus?: number;
  hcp?: number;
  hcpPlus?: number;
  paa?: { sumAssured: number; occupationalClass?: OccupationalClass };
  paab?: { sumAssured: number; occupationalClass?: OccupationalClass };
  /** Waiver of Premium dihitung dari premi dasar, bukan dari uang pertanggungan. */
  wp?: boolean;
  /** Payor rider dihitung dari total premi dan usia pemegang polis. */
  spousePayor?: boolean;
  parentPayor?: boolean;
};

export type MslInput = {
  insuredAge: number;
  /** Jenis kelamin tertanggung; tarif COI MAML dibedakan pria/wanita. */
  insuredSex?: "Male" | "Female";
  /** Usia pemegang polis; hanya dipakai payor rider. */
  policyHolderAge?: number;
  /** Lama pertanggungan (tahun); bila kosong dipakai sampai usia 100. */
  coverageYears?: number;
  /** Masa pembayaran premi dalam tahun (`pterm` di workbook). */
  premiumTermYears: number;
  basicPremium: number;
  /** Top up berkala tetap tiap tahun selama masa bayar (`input!E30` workbook). */
  regularTopUp?: number;
  /**
   * Top up berkala yang dicatat per tahun polis — bentuk yang dipakai formulir
   * Rincian Produk. Dijumlahkan dengan `regularTopUp` pada tahun yang sama.
   */
  regularTopUps?: readonly { year: number; amount: number }[];
  sumAssured: number;
  /** Porsi tiap dana, indeksnya mengikuti MSL_ASSUMPTIONS.funds; total 1. */
  allocations: readonly number[];
  /** Top up tunggal dan penarikan, dicatat pada tahun polis ke berapa. */
  singleTopUps?: readonly { year: number; amount: number }[];
  withdrawals?: readonly { year: number; amount: number }[];
  riders?: MslRiders;
  /** Extra mortalita per komponen, mis. 0,25 untuk +25%. */
  extraMortality?: {
    basic?: number;
    ciPlus?: number;
    hcp?: number;
    hcpPlus?: number;
    paa?: number;
    paab?: number;
    wp?: number;
    spousePayor?: number;
    parentPayor?: number;
  };
};

export type MslScenarioYear = {
  fundStart: number;
  fundEnd: number;
  deathBenefit: number;
  surrenderValue: number;
};

export type MslYear = {
  policyYear: number;
  insuredAge: number;
  basicPremium: number;
  regularTopUp: number;
  singleTopUp: number;
  withdrawal: number;
  accumulatedPremium: number;
  loyaltyBonus: number;
  coiBasic: number;
  coiRiders: number;
  /** Rincian biaya per rider (hanya diisi mesin yang menghitung per rider). */
  riderCosts?: Partial<Record<MslRiderKey, number>>;
  premiumLoading: number;
  adminFee: number;
  netAmountAtRisk: number;
  scenarios: Record<Scenario, MslScenarioYear>;
};

export type MslProjection = {
  years: MslYear[];
  /** Dana yang porsinya di atas nol, untuk keterangan tabel. */
  funds: { name: string; portion: number }[];
};

const A = MSL_ASSUMPTIONS;

/** Jumlah entri (top up / penarikan) pada satu tahun polis. */
export const jumlahTahun = (
  daftar: readonly { year: number; amount: number }[],
  policyYear: number
) =>
  daftar
    .filter((item) => item.year === policyYear)
    .reduce((jumlah, item) => jumlah + item.amount, 0);

/** Ambil nilai tabel dengan indeks dibatasi panjangnya, seperti MIN() di Excel. */
const step = (table: readonly number[], index: number) =>
  table[Math.min(Math.max(index, 1), table.length) - 1] ?? 0;

const coiRow = (age: number) => COI_COR[Math.min(Math.max(age, 1), COI_COR.length) - 1] ?? [];

const rate = (age: number, column: number) => coiRow(age)[column] ?? 0;

const occupationalRate = (
  table: readonly (readonly number[])[],
  age: number,
  oc: OccupationalClass
) => table[Math.min(Math.max(age, 1), table.length) - 1]?.[oc - 1] ?? 0;

/** Biaya surrender: tahun di luar tabel memakai baris terakhir (0%). */
const surrenderCharge = (policyYear: number) =>
  policyYear <= A.surrenderCharge.length
    ? A.surrenderCharge[policyYear - 1]
    : A.surrenderCharge[A.surrenderCharge.length - 1];

/** Persentase santunan meninggal menurut usia tertanggung. */
const deathBenefitFactor = (age: number) =>
  step(A.deathBenefit, Math.min(age, A.deathBenefit.length));

function scenarioReturn(fundIndex: number, scenario: Scenario): number {
  const fund = A.funds[fundIndex];
  if (!fund) return 0;
  return scenario === "negatif" ? fund.negatif : scenario === "nol" ? fund.nol : fund.positif;
}

/**
 * Tarif payor rider: baris dicari menurut usia pemegang polis, kolomnya
 * menurut usia tertanggung (Spouse Payor mulai usia 18, Parent Payor usia 1).
 */
function payorRate(
  table: readonly (readonly number[])[],
  policyHolderAge: number,
  insuredAge: number,
  firstInsuredAge: number
): number {
  const row = table.find((item) => item[0] === policyHolderAge);
  if (!row) return 0;
  return row[insuredAge - firstInsuredAge + 1] ?? 0;
}

export type MslRiderKey = keyof MslRiders;

/** Biaya asuransi tiap rider pada satu tahun polis. */
function riderCosts(
  age: number,
  policyYear: number,
  input: MslInput
): Partial<Record<MslRiderKey, number>> {
  const riders = input.riders ?? {};
  const em = input.extraMortality ?? {};
  const policyHolderAge = (input.policyHolderAge ?? input.insuredAge) + policyYear - 1;
  const totalPremi = input.basicPremium + (input.regularTopUp ?? 0);
  const biaya: Partial<Record<MslRiderKey, number>> = {};

  if (riders.paa && riders.paa.sumAssured > 0) {
    biaya.paa =
      occupationalRate(PAA_RATES, age, riders.paa.occupationalClass ?? 1) *
      riders.paa.sumAssured *
      (1 + (em.paa ?? 0));
  }

  if (riders.paab && riders.paab.sumAssured > 0) {
    biaya.paab =
      occupationalRate(PAAB_RATES, age, riders.paab.occupationalClass ?? 1) *
      riders.paab.sumAssured *
      (1 + (em.paab ?? 0));
  }

  if (riders.hcp) biaya.hcp = rate(age, 3) * riders.hcp * (1 + (em.hcp ?? 0));
  if (riders.hcpPlus) biaya.hcpPlus = rate(age, 4) * riders.hcpPlus * (1 + (em.hcpPlus ?? 0));
  if (riders.ciPlus) biaya.ciPlus = rate(age, 2) * riders.ciPlus * (1 + (em.ciPlus ?? 0));

  // Waiver of Premium hanya selama premi masih dibayar.
  if (riders.wp && policyYear <= input.premiumTermYears) {
    biaya.wp = rate(age, 5) * input.basicPremium * (1 + (em.wp ?? 0));
  }

  if (riders.spousePayor) {
    biaya.spousePayor =
      payorRate(MSP_RATES, policyHolderAge, age, 18) * totalPremi * (1 + (em.spousePayor ?? 0));
  }

  if (riders.parentPayor) {
    biaya.parentPayor =
      payorRate(MPP_RATES, policyHolderAge, age, 1) * totalPremi * (1 + (em.parentPayor ?? 0));
  }

  return biaya;
}

/** Jumlah biaya seluruh rider; urutan penjumlahan sama dengan workbook. */
function riderCost(age: number, policyYear: number, input: MslInput): number {
  return Object.values(riderCosts(age, policyYear, input)).reduce(
    (total, nilai) => total + (nilai ?? 0),
    0
  );
}

/** Biaya tiap rider pada tahun polis pertama, untuk kolom Premi di langkah Rider. */
export function firstYearRiderCosts(input: MslInput): Partial<Record<MslRiderKey, number>> {
  return riderCosts(input.insuredAge, 1, input);
}

/** Saldo satu dana dalam satu skenario. */
type FundState = { basic: number; topUp: number };

export function projectMsl(input: MslInput): MslProjection {
  const coverage =
    input.coverageYears && input.coverageYears > 0
      ? input.coverageYears
      : Math.max(A.coverageAge - input.insuredAge, 0);

  const allocations = A.funds.map((_, index) => input.allocations[index] ?? 0);
  const singleTopUps = input.singleTopUps ?? [];
  const regularTopUps = input.regularTopUps ?? [];
  const withdrawals = input.withdrawals ?? [];

  const state: Record<Scenario, { funds: FundState[] }> = {
    negatif: { funds: A.funds.map(() => ({ basic: 0, topUp: 0 })) },
    nol: { funds: A.funds.map(() => ({ basic: 0, topUp: 0 })) },
    positif: { funds: A.funds.map(() => ({ basic: 0, topUp: 0 })) },
  };
  // Loyalty bonus hangus sejak ada penarikan yang menyentuh dana dasar.
  let bonusHangus = false;

  const years: MslYear[] = [];
  let accumulated = 0;

  for (let policyYear = 1; policyYear <= coverage; policyYear++) {
    const age = input.insuredAge + policyYear - 1;
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

    const loading = basicPremium * step(A.premiumLoading, Math.min(policyYear, 2));
    const topUpLoading = (regularTopUp + singleTopUp) * A.topUpAllocation;
    const adminFee = A.adminFeePerMonth * 12;
    const maintenance = step(A.maintenanceFee, Math.min(policyYear, A.maintenanceFee.length));

    const coiBasic = Math.round(
      rate(age, 1) * input.sumAssured * (1 + (input.extraMortality?.basic ?? 0))
    );
    const coiRiders = riderCost(age, policyYear, input);
    const netAmountAtRisk = input.sumAssured * deathBenefitFactor(age);

    const scenarios = {} as Record<Scenario, MslScenarioYear>;

    // Penarikan diambil lebih dulu dari dana top up, sisanya dari dana dasar.
    // Workbook (rumus `DO`) memakai saldo top up skenario negatif untuk
    // ketiga skenario, jadi pembagiannya dihitung sekali di sini.
    const topUpTersedia = state.negatif.funds.reduce((jumlah, fund) => jumlah + fund.topUp, 0);
    const dariTopUp = Math.max(
      Math.min(topUpTersedia + regularTopUp + singleTopUp - topUpLoading, withdrawal),
      0
    );
    const dariDasar = withdrawal - dariTopUp;
    if (dariDasar > 0) bonusHangus = true;

    const loyaltyBonus =
      bonusHangus || !bayarPremi
        ? 0
        : step(A.loyaltyBonus, Math.min(policyYear, A.loyaltyBonus.length)) * input.basicPremium;

    for (const scenario of SCENARIOS) {
      const current = state[scenario];

      let fundStart = 0;
      let fundEnd = 0;
      let basicEnd = 0;
      let topUpEnd = 0;

      current.funds.forEach((fund, index) => {
        const porsi = allocations[index];
        if (porsi <= 0) {
          fund.basic = 0;
          fund.topUp = 0;
          return;
        }

        const tumbuh = Math.sqrt(1 + scenarioReturn(index, scenario));

        const basicAwal =
          (fund.basic + (basicPremium - loading) * porsi) * tumbuh -
          (coiBasic + coiRiders + adminFee + dariDasar) * porsi -
          A.fundManagementFee * porsi * fund.basic;
        const basicAkhir = (basicAwal - maintenance * basicAwal) * tumbuh + loyaltyBonus * porsi;

        const topUpAwal =
          (fund.topUp + (regularTopUp + singleTopUp - topUpLoading - dariTopUp) * porsi) * tumbuh;
        const topUpAkhir = topUpAwal * tumbuh;

        fund.basic = basicAkhir;
        fund.topUp = topUpAkhir;

        // Output workbook menjumlahkan nilai per dana yang sudah dibulatkan.
        fundStart += Math.round(basicAwal + topUpAwal);
        fundEnd += Math.round(basicAkhir + topUpAkhir);
        basicEnd += basicAkhir;
        topUpEnd += topUpAkhir;
      });

      scenarios[scenario] = {
        fundStart,
        fundEnd,
        deathBenefit: netAmountAtRisk + fundEnd,
        surrenderValue: (1 - surrenderCharge(policyYear)) * basicEnd + topUpEnd,
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
      premiumLoading: loading + topUpLoading,
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
