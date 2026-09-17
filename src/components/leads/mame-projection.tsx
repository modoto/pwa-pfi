"use client";

import { useMemo } from "react";
import { mamePayMode, projectMame } from "@/lib/calc/mame-engine";
import type { IllustrationSteps } from "@/lib/calc/msl-input";
import { hitungUsia } from "@/lib/lead-form-data";

const rupiah = (nilai: number) => Math.round(nilai).toLocaleString("id-ID");
const tahunDari = (teks: string | undefined) => Number(/(\d+)/.exec(teks ?? "")?.[1] ?? 0);

/**
 * Tabel premi dan manfaat Mega Asuransi Maksima Edukasi, dihitung mesin
 * src/lib/calc/mame-engine.ts (terjemahan MAME.xlsx).
 */
export function MameProjection({ steps }: { steps: IllustrationSteps }) {
  const { policyHolder, product } = steps;

  const hasil = useMemo(() => {
    const sekaligus = /sekaligus/i.test(product.cara_bayar ?? "");
    const ct = policyHolder.ct_nama_depan ? "ct_" : "";
    const usiaPp =
      Number(hitungUsia(policyHolder.tanggal_lahir ?? "")) ||
      Number(hitungUsia(policyHolder[`${ct}tanggal_lahir`] ?? "")) ||
      0;
    const input = {
      policyHolderAge: usiaPp,
      sumAssured: Number(product.uang_pertanggungan) || 0,
      policyTerm: tahunDari(product.masa_pertanggungan),
      premiumTerm: sekaligus ? 1 : tahunDari(product.masa_pembayaran),
      payMode: mamePayMode(product.cara_bayar ?? ""),
    };
    if (!input.policyHolderAge || !input.sumAssured || !input.policyTerm || !input.premiumTerm) {
      return null;
    }
    return projectMame(input);
  }, [policyHolder, product]);

  if (!hasil) {
    return (
      <section className="rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
        <p className="text-base font-bold text-pfi-heading">Manfaat belum bisa dihitung</p>
        <p className="mt-2 text-sm text-pfi-muted">
          Lengkapi tanggal lahir pemegang polis, uang pertanggungan, masa pertanggungan, dan masa
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
            {hasil.maturityRate !== null &&
              ` · Beasiswa ${Math.round(hasil.maturityRate * 100)}% dari total premi`}
          </p>
          {hasil.warnings.map((pesan) => (
            <p key={pesan} className="font-medium text-pfi-down-fg">
              {pesan}
            </p>
          ))}
          {hasil.maturityRate === null && (
            <p className="font-medium text-pfi-down-fg">
              Tarif beasiswa untuk kombinasi usia, masa, dan cara bayar ini tidak ada di tabel.
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-right text-sm">
            <thead>
              <tr className="bg-pfi-thead">
                {[
                  "Tahun",
                  "Premi Disetahunkan",
                  "Akumulasi Premi",
                  "Nilai Tunai",
                  "Beasiswa Pendidikan",
                  "Meninggal Dunia",
                  "Meninggal karena Kecelakaan",
                ].map((judul, index) => (
                  <th
                    key={judul}
                    className={`px-3 py-3 font-semibold text-pfi-heading ${index === 0 ? "text-left" : ""}`}
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
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.annualPremium)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {rupiah(tahun.accumulatedPremium)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {tahun.cashValue === null ? "–" : rupiah(tahun.cashValue)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-pfi-heading">
                    {tahun.maturityBenefit ? rupiah(tahun.maturityBenefit) : "–"}
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
