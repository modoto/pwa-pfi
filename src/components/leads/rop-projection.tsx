"use client";

import { useMemo } from "react";
import { ropPayMode, projectRop, type RopProduct } from "@/lib/calc/rop-engine";
import type { IllustrationSteps } from "@/lib/calc/msl-input";
import { hitungUsia } from "@/lib/lead-form-data";

const rupiah = (nilai: number) => Math.round(nilai).toLocaleString("id-ID");
const tahunDari = (teks: string | undefined) => Number(/(\d+)/.exec(teks ?? "")?.[1] ?? 0);

/**
 * Tabel premi dan manfaat produk manfaat tahapan (MSP dan MAMS), dihitung
 * mesin src/lib/calc/rop-engine.ts.
 */
export function RopProjection({
  steps,
  product,
}: {
  steps: IllustrationSteps;
  product: RopProduct;
}) {
  const { policyHolder, product: produk } = steps;

  const hasil = useMemo(() => {
    const ct = policyHolder.ct_nama_depan ? "ct_" : "";
    const input = {
      insuredAge: Number(hitungUsia(policyHolder[`${ct}tanggal_lahir`] ?? "")) || 0,
      sumInsured: Number(produk.uang_pertanggungan) || 0,
      policyTerm: tahunDari(produk.masa_pertanggungan),
      premiumTerm: tahunDari(produk.masa_pembayaran),
      payMode: ropPayMode(produk.cara_bayar ?? ""),
    };
    if (!input.insuredAge || !input.sumInsured || !input.policyTerm || !input.premiumTerm) {
      return null;
    }
    return projectRop(product, input);
  }, [policyHolder, produk, product]);

  if (!hasil) {
    return (
      <section className="rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
        <p className="text-base font-bold text-pfi-heading">Manfaat belum bisa dihitung</p>
        <p className="mt-2 text-sm text-pfi-muted">
          Lengkapi tanggal lahir tertanggung, uang pertanggungan, masa asuransi, dan masa
          pembayaran terlebih dahulu.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
      <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
        <h2 className="text-lg font-bold text-pfi-heading">Tabel Premi dan Manfaat Asuransi</h2>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-1 rounded-[10px] bg-pfi-bg px-4 py-3 text-sm text-pfi-muted">
          <p>
            Premi tahunan Rp{rupiah(hasil.annualPremium)}
            {hasil.monthlyPremium !== null && ` (Rp${rupiah(hasil.monthlyPremium)} per bulan)`} ·
            Total premi Rp{rupiah(hasil.totalPremium)}
            {hasil.survivalBenefitRate !== null &&
              ` · Manfaat tahapan ${Math.round(hasil.survivalBenefitRate * 100)}% = Rp${rupiah(hasil.totalSurvivalBenefit)}`}
          </p>
          {hasil.warnings.map((pesan) => (
            <p key={pesan} className="font-medium text-pfi-down-fg">
              {pesan}
            </p>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-right text-sm">
            <thead>
              <tr className="bg-pfi-thead">
                {[
                  "Tahun",
                  "Usia",
                  "Premi Tahunan",
                  "Akumulasi Premi",
                  "Manfaat Tahapan",
                  "Akumulasi Tahapan",
                  "Meninggal Dunia",
                  "Meninggal karena Kecelakaan",
                ].map((judul, index) => (
                  <th
                    key={judul}
                    className={`px-3 py-3 font-semibold text-pfi-heading ${index < 2 ? "text-left" : ""}`}
                  >
                    {judul}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hasil.years.map((tahun) => (
                <tr key={tahun.policyYear} className="border-b border-pfi-hairline">
                  <td className="px-3 py-3 text-left text-pfi-heading">{tahun.policyYear}</td>
                  <td className="px-3 py-3 text-left text-pfi-heading">{tahun.insuredAge}</td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.annualPremium)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.accumulatedPremium)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {tahun.survivalBenefit ? rupiah(tahun.survivalBenefit) : "–"}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.accumulatedSurvivalBenefit)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.deathBenefit)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.accidentalDeathBenefit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
