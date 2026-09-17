/**
 * Pengisi penanda template RIPLAY Personal.
 *
 * Template `.docx` dari tim bisnis memakai penanda dalam kurung siku sudut,
 * mis. `<Name of Policy Holder>`. Nilai yang sama di semua template (data
 * nasabah, premi, uang pertanggungan, agen, tanggal cetak) disusun sekali di
 * `nilaiUmum`; tabel dan angka khusus produk disusun per template:
 *
 * - MAML dan MSL: proyeksi dari mesin MSL.xlsm (src/lib/calc), lihat
 *   docs/kalkulator-ilustrasi.md.
 * - MAME (FUW / SIO): mesin MAME.xlsx (src/lib/calc/mame-engine.ts) — premi
 *   dari UP, manfaat meninggal, nilai tunai, dan beasiswa.
 * - MSP dan MAMS: mesin manfaat tahapan (src/lib/calc/rop-engine.ts) —
 *   manfaat tahapan dan kelipatan akumulasi premi.
 * - Produk lain belum punya sumber hitungan; hanya nilai umum yang terisi dan
 *   penanda aktuaria dibiarkan tampil.
 */

import type { MslProjection } from "@/lib/calc/msl-engine";
import { MSL_ASSUMPTIONS } from "@/lib/calc/msl-tables";
import type { RiplayFill } from "@/lib/riplay-fill";
import type { RiplayTemplateId } from "@/lib/riplay-templates";
import { FUND_CODE_TO_WORKBOOK_INDEX, LEGACY_FUND_NAMES } from "@/lib/investment-data";
import { hitungUsia } from "@/lib/lead-form-data";
import { mamePayMode, projectMame } from "@/lib/calc/mame-engine";
import { ropPayMode, projectRop } from "@/lib/calc/rop-engine";
import { RIDER_TANPA_UP, ridersTerpilih, type RiderTerpilih } from "@/lib/rider-data";

export type RiplaySources = {
  policyHolder: Record<string, string>;
  product: Record<string, string>;
  investment: Record<string, string>;
  rider: Record<string, string>;
  agentName: string | null;
  /** Kode agen (`agentCode` di sesi); dipakai template MAMS. */
  agentCode?: string | null;
  /** Hasil mesin MSL; hanya diisi untuk template yang memakai kalkulator itu. */
  projection: MslProjection | null;
};

/** Hasil isian khusus template; digabung dengan nilai umum. */
type IsianKhusus = Partial<RiplayFill>;

const angka = (nilai: string | undefined) => Number(String(nilai ?? "").replace(/\D/g, "")) || 0;
const rupiah = (nilai: number) => Math.round(nilai).toLocaleString("id-ID");
const persen = (nilai: number) => `${Math.round(nilai * 1000) / 10}%`.replace(".", ",");

/**
 * Tabel proyeksi investasi di template bersatuan **jutaan rupiah** (tabel
 * penebusan polis tetap rupiah penuh).
 */
const juta = (nilai: number) =>
  (nilai / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 });

/** "10 Tahun" → 10. */
const tahunDari = (teks: string | undefined) => Number(/(\d+)/.exec(teks ?? "")?.[1] ?? 0);

/** ISO (yyyy-mm-dd) → dd/mm/yyyy, sesuai format yang diminta template. */
function tanggal(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const ddmmyyyy = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

function nama(values: Record<string, string>, prefix = ""): string {
  return [values[`${prefix}nama_depan`], values[`${prefix}nama_tengah`], values[`${prefix}nama_belakang`]]
    .filter(Boolean)
    .join(" ");
}

function totalBerkala(raw: string | undefined): number {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce<number>(
      (jumlah, item) => jumlah + angka(String((item as { jumlah?: string })?.jumlah ?? "")),
      0
    );
  } catch {
    return 0;
  }
}

type Dana = { nama: string; persen: number; asumsi: { negatif: number; nol: number; positif: number } | null };

function alokasiInvestasi(raw: string | undefined): Dana[] {
  try {
    const parsed: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];

    return (parsed as { code?: string; fund?: string; persen?: number }[]).map((row) => {
      const index =
        row.code !== undefined
          ? (FUND_CODE_TO_WORKBOOK_INDEX[row.code] ?? -1)
          : LEGACY_FUND_NAMES.indexOf((row.fund ?? "") as (typeof LEGACY_FUND_NAMES)[number]);
      const fund = MSL_ASSUMPTIONS.funds[index];
      return {
        nama: row.fund ?? "",
        persen: Number(row.persen) || 0,
        asumsi: fund ? { negatif: fund.negatif, nol: fund.nol, positif: fund.positif } : null,
      };
    });
  } catch {
    return [];
  }
}

/** Berapa kali premi dibayar dalam setahun menurut cara bayar. */
function kaliSetahun(caraBayar: string): number {
  const teks = caraBayar.toLowerCase();
  if (teks.includes("bulan")) return 12;
  if (teks.includes("triwulan") || teks.includes("kuartal")) return 4;
  if (teks.includes("semester")) return 2;
  return 1;
}

/** Semua data turunan yang dipakai lebih dari satu template. */
function konteks(sources: RiplaySources) {
  const { policyHolder, product, investment, rider } = sources;

  // Untuk tujuan "Diri Sendiri" tidak ada data calon tertanggung terpisah.
  const ct = policyHolder.ct_nama_depan ? "ct_" : "";
  const caraBayar = product.cara_bayar ?? "";
  const sekaligus = caraBayar.toLowerCase().includes("sekaligus");
  const premiDasar = angka(product.premi_dasar);
  const masaBayar = sekaligus ? 1 : tahunDari(product.masa_pembayaran);

  const hariIni = new Date();

  return {
    ...sources,
    ct,
    usiaTertanggung: Number(hitungUsia(policyHolder[`${ct}tanggal_lahir`] ?? "")) || 0,
    caraBayar,
    sekaligus,
    premiDasar,
    /** Premi dasar yang disetahunkan. */
    premiTahunan: sekaligus ? premiDasar : premiDasar * kaliSetahun(caraBayar),
    topUpBerkala: totalBerkala(product.top_up_berkala),
    topUpTunggal: angka(product.top_up_tunggal_jumlah),
    uangPertanggungan: angka(product.uang_pertanggungan),
    masaBayar,
    masaTanggung: tahunDari(product.masa_pertanggungan),
    riders: ridersTerpilih(rider),
    dana: alokasiInvestasi(investment.alokasi),
    cetak: ddmmyyyy(hariIni),
    cetakPlus30: ddmmyyyy(new Date(hariIni.getTime() + 30 * 24 * 60 * 60 * 1000)),
  };
}

type Konteks = ReturnType<typeof konteks>;

/** Rider berbasis premi (WP, payor) tidak punya uang pertanggungan sendiri. */
const upRider = (item: RiderTerpilih) =>
  item.mesin && RIDER_TANPA_UP.has(item.mesin) ? "–" : rupiah(angka(item.up));
const manfaatRider = (item: RiderTerpilih) => {
  const up = upRider(item);
  return up === "–" ? up : `Rp${up}`;
};

/**
 * Nilai yang sama di semua template. Kuncinya dicocokkan longgar (tanpa huruf
 * besar/kecil dan tanda baca), jadi satu kunci melayani berbagai ejaan.
 */
function nilaiUmum(k: Konteks): Record<string, string> {
  const { policyHolder: ph, ct } = k;
  const namaPp = ph.nama_lembaga || nama(ph);
  const usiaPp = hitungUsia(ph.tanggal_lahir ?? "");
  const usiaTt = k.usiaTertanggung ? String(k.usiaTertanggung) : "";
  const up = k.uangPertanggungan ? rupiah(k.uangPertanggungan) : "";
  const totalPremi = k.premiDasar + k.topUpBerkala;
  const semuaPremi = k.premiDasar + k.topUpBerkala + k.topUpTunggal;
  const danaNama = k.dana.map((d) => d.nama).filter(Boolean).join(", ");
  const danaPersen = k.dana.map((d) => `${d.persen}%`).join(", ");
  const totalPersen = k.dana.length ? `${k.dana.reduce((jumlah, d) => jumlah + d.persen, 0)}%` : "";

  return {
    "Name of Policy Holder": namaPp,
    "Policy Holder Name": namaPp,
    "Policy Holder's name": namaPp,
    "DOB of Policy Holder DD/MM/YYYY": tanggal(ph.tanggal_lahir ?? ""),
    "Policy Holder age": usiaPp,
    "Age of Policy Holder": usiaPp,
    "Policy Holder gender": ph.jenis_kelamin ?? "",

    "Name of Insured": nama(ph, ct),
    "DOB of Insured DD/MM/YYYY": tanggal(ph[`${ct}tanggal_lahir`] ?? ""),
    "age of Insured": usiaTt,
    "Insured age": usiaTt,
    "Insured gender": ph[`${ct}jenis_kelamin`] ?? "",

    "Sum Assured": up,
    "Basic Sum Assured": up,
    "Total Sum Assured": up,
    // Hampir semua template menulis "<Coverage period> tahun", jadi cukup angkanya.
    "Coverage period": k.masaTanggung ? String(k.masaTanggung) : "",
    "Premium payment period": k.masaBayar ? String(k.masaBayar) : "",
    "Premium Payment Term": k.masaBayar ? String(k.masaBayar) : "",
    "Premium payment plan": k.masaBayar ? String(k.masaBayar) : "",
    "Premium payment method": k.caraBayar,
    "Premium payment mode": k.caraBayar,
    "Premium mode payment": k.caraBayar,
    "Premium Frequency": k.caraBayar,
    "Premium Frequency Payment": k.caraBayar,
    "Top up payment method": k.topUpBerkala ? k.caraBayar : "-",

    "Total Premium": rupiah(totalPremi),
    "Basic Premium": rupiah(k.premiDasar),
    "Regular basic premium": rupiah(k.premiDasar),
    "Annualized Premium": rupiah(k.premiTahunan),
    "Annual basic premium": rupiah(k.premiTahunan),
    "Annual premium": rupiah(k.premiTahunan),
    "Total annual premium": rupiah(k.premiTahunan),
    "Annual total premium": rupiah(k.premiTahunan),
    "Regular Top Up": rupiah(k.topUpBerkala),
    "Single top-up": rupiah(k.topUpTunggal),
    "Basic premium+Regular topup+ single topup": rupiah(semuaPremi),
    "Total Premium+Topup if any": rupiah(semuaPremi),
    "Basic Premium+single topup": rupiah(k.premiDasar + k.topUpTunggal),

    "Name of Riders": k.riders.map((item) => item.nama).join(", "),
    "Name of Rider": k.riders.map((item) => item.nama).join(", "),
    "riders benefit": k.riders.map(manfaatRider).join(", "),
    // Template MAML sudah menulis "Rp" di depan penanda ini.
    "Rider benefit/Sum Assured": k.riders.map(upRider).join(", "),

    "Investment fund": danaNama,
    "Chosen investment fund": danaNama,
    "percentage of investment fund": danaPersen,
    "Percentage of chosen investment fund": danaPersen,
    "Total percentage": totalPersen,

    "Name of Agent": k.agentName ?? "",
    "Agent's name": k.agentName ?? "",
    // Template MSP menulis penandanya tanpa spasi.
    AgentName: k.agentName ?? "",
    "Agent code": k.agentCode ?? "",
    "Printing Date": k.cetak,
    "Printing date DD/MM/YYYY": k.cetak,
    "30 days after printing date": k.cetakPlus30,
  };
}

/* ------------------------------------------------------------------ */
/* Template dengan proyeksi MSL.xlsm (MAML dan MSL)                    */
/* ------------------------------------------------------------------ */

const SKENARIO_MODERAT = "nol" as const;

/** Tiga sel asumsi tingkat hasil investasi (negatif, nol, positif) tabel dana. */
function asumsiDana(k: Konteks): string[] {
  const dana = k.dana.filter((d) => d.asumsi);
  if (dana.length === 0) return [];
  const kolom = (skenario: "negatif" | "nol" | "positif") =>
    dana.map((d) => persen(d.asumsi?.[skenario] ?? 0)).join(" / ");
  return [kolom("negatif"), kolom("nol"), kolom("positif")];
}

/** Tabel proyeksi: Penarikan, Bonus Loyalitas, lalu Nilai Polis per skenario. */
function barisProyeksi(projection: MslProjection, jumlahBaris: number) {
  const baris = Array.from({ length: jumlahBaris }, (_, i) => projection.years[i] ?? null);
  const kolom = (ambil: (row: NonNullable<(typeof baris)[number]>) => string) =>
    baris.map((row) => (row ? ambil(row) : "-"));

  return {
    kolom,
    aktuaria: baris.flatMap((row) =>
      row
        ? [
            juta(row.withdrawal),
            juta(row.loyaltyBonus),
            juta(row.scenarios.negatif.fundEnd),
            juta(row.scenarios.nol.fundEnd),
            juta(row.scenarios.positif.fundEnd),
          ]
        : ["-", "-", "-", "-", "-"]
    ),
  };
}

/** Nilai tebus tahun-tahun awal (rupiah penuh), tiga skenario per baris. */
function barisPenebusan(projection: MslProjection, tahun: number[]): string[] {
  return tahun.flatMap((nomor) => {
    const row = projection.years[nomor - 1];
    return row
      ? (["negatif", "nol", "positif"] as const).map((s) =>
          rupiah(Math.max(row.scenarios[s].surrenderValue, 0))
        )
      : ["-", "-", "-"];
  });
}

function biayaBulanan(projection: MslProjection): Record<string, string> {
  const pertama = projection.years[0];
  if (!pertama) return {};
  return {
    "Cost of Insurance/month": rupiah(pertama.coiBasic / 12),
    "Cost of Insurance per month": rupiah(pertama.coiBasic / 12),
    "amount of CoI/month": rupiah(pertama.coiBasic / 12),
    "Cost of Rider/month": rupiah(pertama.coiRiders / 12),
  };
}

/** Mega Asuransi Maksima Link — template `replay_personal_maml.docx`. */
function isianMaml(k: Konteks): IsianKhusus {
  const values: Record<string, string> = {
    // Usia masuk ("<age of insured> tahun") berbeda dengan penanda simulasi
    // meninggal di tahun ke-10 ("<age of Insured>") yang diisi di bawah.
    "age of insured": k.usiaTertanggung ? String(k.usiaTertanggung) : "",
  };
  // Nama produk sudah tertulis tetap di sel yang sama.
  const blanks = ["Name of Product"];
  if (!k.projection || k.projection.years.length === 0) return { values, blanks };

  const { kolom, aktuaria } = barisProyeksi(k.projection, 60);
  const tahun10 = k.projection.years[9];
  const tahun4 = k.projection.years[3];
  const tahun5 = k.projection.years[4];

  // Simulasi pada template memakai asumsi tingkat investasi positif.
  if (tahun10) {
    const nilai = tahun10.scenarios.positif.fundEnd;
    values["age of Insured"] = String(tahun10.insuredAge);
    values["Fund Value"] = rupiah(nilai);
    values["Sum Assured + Fund Value"] = rupiah(k.uangPertanggungan + nilai);
  }
  if (tahun4) {
    values["Fund Value in 4th policy year – (30% fund value in 4th policy year)"] = rupiah(
      0.7 * Math.max(tahun4.scenarios.positif.fundEnd, 0)
    );
  }
  if (tahun5) {
    values["Fund value in 5th policy year – (20% fund value in 5th policy year)"] = rupiah(
      0.8 * Math.max(tahun5.scenarios.positif.fundEnd, 0)
    );
  }

  return {
    values: { ...values, ...biayaBulanan(k.projection) },
    blanks,
    sequences: {
      // Kemunculan pertama masing-masing ada di ringkasan (rupiah penuh / usia
      // masuk), baru kemudian 60 baris tabel proyeksi (jutaan rupiah).
      "Regular basic premium": [rupiah(k.premiDasar), ...kolom((row) => juta(row.basicPremium))],
      "Age of Insured": [String(k.usiaTertanggung), ...kolom((row) => String(row.insuredAge))],
      "Policy Year": kolom((row) => String(row.policyYear)),
      "Regular Top up": kolom((row) => juta(row.regularTopUp)),
      "Single Top up": kolom((row) => juta(row.singleTopUp)),
      // 3 sel asumsi dana, 60 × 5 sel tabel proyeksi, 5 × 3 sel penebusan.
      "Refer to actuarial calc": [
        ...(asumsiDana(k).length ? asumsiDana(k) : ["-", "-", "-"]),
        ...aktuaria,
        ...barisPenebusan(k.projection, [1, 2, 3, 4, 5]),
      ],
    },
  };
}

/** Mega Signature Link — template pertama `riplay_personal_msl.docx`. */
function isianMsl(k: Konteks): IsianKhusus {
  const up = k.uangPertanggungan;
  const values: Record<string, string> = {
    "20% of Basic Sum Assured": rupiah(0.2 * up),
    "40% of Basic Sum Assured": rupiah(0.4 * up),
    "60% of Basic Sum Assured": rupiah(0.6 * up),
    "80% of Basic Sum Assured": rupiah(0.8 * up),
    "100% of Basic Sum Assured": rupiah(up),
  };
  if (!k.projection || k.projection.years.length === 0) return { values };

  const { kolom, aktuaria } = barisProyeksi(k.projection, 60);
  const tahun5 = k.projection.years[4];
  const tahun7 = k.projection.years[6];
  const tahun10 = k.projection.years[9];
  if (tahun7) {
    values["Fund Value in 7th policy year - (5% of fund value in 7th Policy year)"] = rupiah(
      0.95 * Math.max(tahun7.scenarios[SKENARIO_MODERAT].fundEnd, 0)
    );
  }
  if (tahun10) {
    const nilai = tahun10.scenarios[SKENARIO_MODERAT].fundEnd;
    values["Fund Value in 10th Policy year"] = rupiah(nilai);
    values["Basic Sum Assured+Fund Value in 10th policy year"] = rupiah(up + nilai);
  }
  if (tahun5) {
    values["20% of Fund Value in 5th Policy year"] = rupiah(
      0.2 * tahun5.scenarios[SKENARIO_MODERAT].fundEnd
    );
  }

  return {
    values: { ...values, ...biayaBulanan(k.projection) },
    sequences: {
      "Policy year": kolom((row) => String(row.policyYear)),
      "Age of Insured": kolom((row) => String(row.insuredAge)),
      "Regular Basic premium": kolom((row) => juta(row.basicPremium)),
      "Regular Topup": kolom((row) => juta(row.regularTopUp)),
      "Single Topup": kolom((row) => juta(row.singleTopUp)),
      // 3 sel asumsi dana, 60 × 5 sel tabel proyeksi, 7 × 3 sel penebusan.
      "refer to actuarial calc": [
        ...(asumsiDana(k).length ? asumsiDana(k) : ["-", "-", "-"]),
        ...aktuaria,
        ...barisPenebusan(k.projection, [1, 2, 3, 4, 5, 6, 7]),
      ],
    },
  };
}

/* ------------------------------------------------------------------ */
/* Mega Asuransi Maksima Edukasi (FUW / SIO)                            */
/* ------------------------------------------------------------------ */

/** Baris tabel "Premi dan Manfaat Asuransi" di template MAME. */
const BARIS_MAME = 10;

/** Teks contoh di kolom Nilai Tunai tabel MAME, diganti angka per tahun. */
const TEKS_NILAI_TUNAI = "The value shown is Cash value. Please refer to the cash value table from actuary.";

/** Mega Asuransi Maksima Edukasi — dihitung mesin MAME.xlsx (mame-engine.ts). */
function isianMame(k: Konteks): IsianKhusus {
  const ph = k.policyHolder;
  // Tarif MAME dicari menurut usia pemegang polis; untuk PP badan usaha
  // (tanpa tanggal lahir) dipakai usia tertanggung.
  const usiaPp = Number(hitungUsia(ph.tanggal_lahir ?? "")) || k.usiaTertanggung;
  const proyeksi = projectMame({
    policyHolderAge: usiaPp,
    sumAssured: k.uangPertanggungan,
    policyTerm: k.masaTanggung,
    premiumTerm: k.masaBayar,
    payMode: mamePayMode(k.caraBayar),
  });
  const tahun = (t: number) => proyeksi.years[t - 1];
  const terakhir = proyeksi.years.at(-1);

  const values: Record<string, string> = {
    // "Masa Pembayaran Premi : <Premium payment period>" tanpa kata "tahun".
    "Premium payment period": k.masaBayar ? `${k.masaBayar} Tahun` : "",
    "Total premium": rupiah(proyeksi.monthlyPremium ?? proyeksi.annualPremium),
    "Annualized Premium": rupiah(proyeksi.annualPremium),
    // Simulasi: meninggal di bulan ke-12 karena sakit, bulan ke-24 karena kecelakaan.
    "Natural death benefit": tahun(1) ? rupiah(tahun(1).deathBenefit) : "",
    "accidental death benefit": tahun(2) ? rupiah(tahun(2).accidentalDeathBenefit) : "",
    "Payout benefit": terakhir?.maturityBenefit ? rupiah(terakhir.maturityBenefit) : "",
  };

  const baris = Array.from({ length: BARIS_MAME }, (_, i) => tahun(i + 1));
  const kolom = (ambil: (y: NonNullable<(typeof baris)[number]>) => string) =>
    baris.map((y) => (y ? ambil(y) : "-"));

  return {
    values,
    sequences: {
      "Current insured age": baris.map((y, i) => (y ? String(k.usiaTertanggung + i) : "-")),
      "Policy Year": kolom((y) => String(y.policyYear)),
      "Natural Death benefit": kolom((y) => rupiah(y.deathBenefit)),
      // Template SIO memakai ejaan yang sama untuk simulasi kecelakaan, jadi
      // kemunculan ke-11 diisi nilai simulasi.
      "Accidental death benefit": [
        ...kolom((y) => rupiah(y.accidentalDeathBenefit)),
        values["accidental death benefit"],
      ],
    },
    literals: [
      // Sembilan baris pertama tabel memuat teks contoh nilai tunai.
      [TEKS_NILAI_TUNAI, kolom((y) => (y.cashValue === null ? "-" : rupiah(y.cashValue))).slice(0, 9)],
      // Catatan untuk penyusun template setelah penanda manfaat.
      [" please refer to actuary calculator", ""],
      [" refer to actuarial calculator", ""],
      ["Refer to actuarial calculator", ""],
    ],
  };
}

/**
 * Mega Warisan — penandanya berkurung siku dan rumusnya ditulis di penanda
 * itu sendiri, mis. `[Maturitybenefitamount=Total Premium paid*110%]`.
 */
function isianWarisan(k: Konteks): IsianKhusus {
  const totalPremi = k.premiTahunan * (k.masaBayar || 1);
  const tertanggung = k.policyHolder[`${k.ct}jenis_kelamin`] ?? "";

  return {
    values: {
      Gender: tertanggung.toLowerCase(),
      Premium: rupiah(k.premiDasar),
      PlanName: k.product.nama_produk ?? "",
      "Maturitybenefitamount=Total Premium paid*110%": rupiah(1.1 * totalPremi),
      "NonAccidentalDeathSumAssured=100%SA": rupiah(k.uangPertanggungan),
      "AccidentalDeathSumAssured=200%SA": rupiah(2 * k.uangPertanggungan),
      "Surendervalue = Total Premium paid*70%": rupiah(0.7 * totalPremi),
    },
  };
}

/**
 * Mega Saving Protection — dihitung mesin MSP.xlsm (msp-engine.ts).
 *
 * Seluruh angka di template berputar pada akumulasi premi: manfaat meninggal
 * 200% (kecelakaan 400%) dan manfaat tahapan yang totalnya
 * `SurvivalBenefitPercentage` × total premi.
 */
function isianMsp(k: Konteks): IsianKhusus {
  const proyeksi = projectRop("msp", {
    insuredAge: k.usiaTertanggung,
    sumInsured: k.uangPertanggungan,
    policyTerm: k.masaTanggung,
    premiumTerm: k.masaBayar,
    payMode: ropPayMode(k.caraBayar),
  });

  const premi = proyeksi.monthlyPremium ?? proyeksi.annualPremium;
  const tahunKe5 = proyeksi.years[4]?.accumulatedPremium ?? 0;
  const total = proyeksi.totalSurvivalBenefit;
  const kelamin = k.policyHolder[`${k.ct}jenis_kelamin`] ?? "";

  return {
    values: {
      InsuredAge: k.usiaTertanggung ? String(k.usiaTertanggung) : "",
      // Template meminta "Pria"/"Wanita", bukan "Laki-Laki"/"Perempuan".
      "InsuredGender (“Pria” or “Wanita”)": /perempuan|wanita/i.test(kelamin)
        ? "Wanita"
        : kelamin
          ? "Pria"
          : "",
      RegulerPremium: rupiah(premi),
      RegulerBasicPremium: rupiah(premi),
      "RegulerBasicPremium + AdditionalPremium (if any)": rupiah(premi),
      "CoverageTerm (15 – 20)": k.masaTanggung ? String(k.masaTanggung) : "",
      CoverageTerm: k.masaTanggung ? String(k.masaTanggung) : "",
      "PremiumPaymentTerm (7 – 10)": k.masaBayar ? String(k.masaBayar) : "",
      PremiumPaymentTerm: k.masaBayar ? String(k.masaBayar) : "",
      "PremiumPaymentMethod (“Tahunan” or “Bulanan”)": k.caraBayar,
      PremiumPaymentMethod: k.caraBayar,

      "200% Total Premium Paid": rupiah(2 * proyeksi.totalPremium),
      "400% Total Premium Paid": rupiah(4 * proyeksi.totalPremium),
      "200% Accumulated Premium Paid at Policy Year 5": rupiah(2 * tahunKe5),
      "400% Accumulated Premium Paid at Policy Year 5": rupiah(4 * tahunKe5),
      "200% Accumulated Premium Paid at Policy Year 5 + Accumulated Survival Benefit": rupiah(
        2 * tahunKe5 + total
      ),
      "400% Accumulated Premium Paid at Policy Year 5 + Accumulated Survival Benefit": rupiah(
        4 * tahunKe5 + total
      ),

      SurvivalBenefitPercentage:
        proyeksi.survivalBenefitRate === null
          ? ""
          : String(Math.round(proyeksi.survivalBenefitRate * 100)),
      "Total Survival Benefit": rupiah(total),
      "The rest of Survival Benefit, 3rd – 5th cash payment": rupiah(proyeksi.sisaTahapan),
    },
  };
}

/**
 * Mega Asuransi Maksima Solusi — mesin yang sama dengan MSP, tapi templatenya
 * memakai penanda dan tabel yang berbeda:
 *
 * - tabel skenario manfaat tahapan: lima `<refer to actuarial calc>` untuk lima
 *   tahun pembayaran terakhir;
 * - tabel manfaat meninggal: `<Policy Year>` beserta manfaat 200% dan 400%
 *   akumulasi premi, satu baris per tahun polis;
 * - tiga tabel skenario meninggal (`<refer to actuarial cacl>`, ejaan asli
 *   template): sisa manfaat tahapan 5 + 5 + 3 baris.
 *
 * Tabel tarif brosur di bagian belakang (`percentage of living benefit` ×342)
 * memuat kolom masa bayar 5 dan 6 yang tidak ada di workbook, jadi dibiarkan —
 * isinya ketentuan produk, bukan angka milik lead ini.
 */
function isianMams(k: Konteks): IsianKhusus {
  const proyeksi = projectRop("mams", {
    insuredAge: k.usiaTertanggung,
    sumInsured: k.uangPertanggungan,
    policyTerm: k.masaTanggung,
    premiumTerm: k.masaBayar,
    payMode: ropPayMode(k.caraBayar),
  });

  const tahapan = proyeksi.years.filter((tahun) => tahun.survivalBenefit > 0);
  const tigaTerakhir = tahapan.slice(-3);
  const akumulasiTahunKe5 = proyeksi.years[4]?.accumulatedPremium ?? 0;

  const values: Record<string, string> = {
    "Annual basic premium": rupiah(proyeksi.annualPremium),
    "annual premium": rupiah(proyeksi.annualPremium),
    "Premium payment period": k.masaBayar ? String(k.masaBayar) : "",
    "coverage period": k.masaTanggung ? String(k.masaTanggung) : "",
    // Lama pembayaran tahapan = jumlah tahun yang menerima manfaat tahapan.
    "scheduled living benefit payment": tahapan.length ? String(tahapan.length) : "",
    "Total living benefit": rupiah(proyeksi.totalSurvivalBenefit),
    "percentage of accumulation premium, refer to actuarial calc":
      proyeksi.survivalBenefitRate === null
        ? ""
        : String(Math.round(proyeksi.survivalBenefitRate * 100)),
    "400% of accumulation premium": rupiah(4 * akumulasiTahunKe5),
  };

  const tahun = proyeksi.years;

  return {
    values,
    sequences: {
      // Skenario 1: manfaat tahapan lima tahun terakhir.
      "refer to actuarial calc": tahapan.map((item) => rupiah(item.survivalBenefit)),

      // Tiga paragraf skenario: meninggal tahun ke-5, lalu dua skenario setelah
      // masa bayar selesai (memakai total premi).
      "200% of accumulation premium": [
        rupiah(2 * akumulasiTahunKe5),
        rupiah(2 * proyeksi.totalPremium),
        rupiah(2 * proyeksi.totalPremium),
      ],

      // Tabel manfaat meninggal per tahun polis.
      "Policy Year": tahun.map((item) => String(item.policyYear)),
      "Natural death benefit, refer to actuarial calc": tahun.map((item) =>
        rupiah(item.deathBenefit)
      ),
      "Accidental death benefit, refer to actuarial calc": tahun.map((item) =>
        rupiah(item.accidentalDeathBenefit)
      ),

      // Tiga tabel skenario meninggal: seluruh jadwal (5), lalu sisanya (5, 3),
      // menyusul tabel ringkasan per tahun polis di bagian belakang dokumen.
      "Policy year": [
        ...[...tahapan, ...tahapan, ...tigaTerakhir].map((item) => String(item.policyYear)),
        ...tahun.map((item) => String(item.policyYear)),
      ],
      "refer to actuarial cacl": [...tahapan, ...tahapan, ...tigaTerakhir].map((item) =>
        rupiah(item.survivalBenefit)
      ),

      // Tabel ringkasan: usia masuk di ringkasan atas, lalu satu baris per tahun.
      "age of Insured": [
        k.usiaTertanggung ? String(k.usiaTertanggung) : "-",
        ...tahun.map((item) => String(item.insuredAge)),
      ],
      "annual premium": tahun.map((item) => rupiah(item.annualPremium)),
      "death benefit refer to actuarial calc": tahun.map((item) => rupiah(item.deathBenefit)),
    },
    // Template menyisakan tahun contoh di sel yang sama dengan penandanya
    // (`<Policy year> 11`); kalau tidak dibuang, hasilnya menempel jadi "1711".
    literalsBefore: [11, 12, 13, 14, 15].flatMap((tahunContoh) => [
      [`<Policy year> ${tahunContoh}`, "<Policy year>"] as [string, string],
      [`<Policy year>${tahunContoh}`, "<Policy year>"] as [string, string],
    ]),
  };
}

const ISIAN: Partial<Record<RiplayTemplateId, (k: Konteks) => IsianKhusus>> = {
  maml: isianMaml,
  msl: isianMsl,
  mame_fuw: isianMame,
  mame_sio: isianMame,
  mega_warisan: isianWarisan,
  msp: isianMsp,
  mams: isianMams,
};

/** Template yang tabelnya dihitung mesin MSL.xlsm. */
export const TEMPLATE_MSL: ReadonlySet<RiplayTemplateId> = new Set(["maml", "msl"]);

/** Seluruh isian satu template: nilai tetap, nilai berurutan, dan yang dihapus. */
export function riplayValues(template: RiplayTemplateId, sources: RiplaySources): RiplayFill {
  const k = konteks(sources);
  const khusus = ISIAN[template]?.(k) ?? {};

  return {
    values: { ...nilaiUmum(k), ...khusus.values },
    sequences: khusus.sequences ?? {},
    skips: khusus.skips ?? {},
    blanks: khusus.blanks ?? [],
    literals: khusus.literals ?? [],
    literalsBefore: khusus.literalsBefore ?? [],
  };
}

/** Nama pemegang polis untuk nama berkas unduhan. */
export function namaPemegangPolis(policyHolder: Record<string, string>): string {
  return policyHolder.nama_lembaga || nama(policyHolder);
}
