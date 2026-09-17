"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SCENARIOS, type Scenario } from "@/lib/calc/msl-engine";
import { projectUnitLink, unitLinkProductOf } from "@/lib/calc/unit-link";
import { buildMslInput, riderTanpaTarif, type IllustrationSteps } from "@/lib/calc/msl-input";

const LABEL: Record<Scenario, string> = {
  negatif: "Rendah",
  nol: "Sedang",
  positif: "Tinggi",
};

const rupiah = (nilai: number) =>
  Math.round(nilai).toLocaleString("id-ID", { maximumFractionDigits: 0 });

/**
 * Tabel proyeksi ilustrasi, dihitung dari isian langkah-langkah sebelumnya.
 *
 * Perhitungannya ada di src/lib/calc/msl-engine.ts — terjemahan MSL.xlsm yang
 * hasilnya sudah dicocokkan dengan workbook.
 */
export function IllustrationProjection({ steps }: { steps: IllustrationSteps }) {
  const [scenario, setScenario] = useState<Scenario>("positif");
  const [semua, setSemua] = useState(false);

  const input = useMemo(() => buildMslInput(steps), [steps]);
  const produk = unitLinkProductOf(steps.product.nama_produk);
  const proyeksi = useMemo(
    () => (input ? projectUnitLink(produk, input) : null),
    [input, produk]
  );
  const tanpaTarif = riderTanpaTarif(steps.rider);

  if (!proyeksi || proyeksi.years.length === 0) {
    return (
      <section className="rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
        <p className="text-base font-bold text-pfi-heading">Proyeksi belum bisa dihitung</p>
        <p className="mt-2 text-sm text-pfi-muted">
          Lengkapi tanggal lahir, premi dasar, uang pertanggungan, masa pertanggungan, dan alokasi
          dana investasi terlebih dahulu.
        </p>
      </section>
    );
  }

  const totalAlokasi = proyeksi.funds.reduce((jumlah, fund) => jumlah + fund.portion, 0);
  const baris = semua ? proyeksi.years : proyeksi.years.slice(0, 10);

  return (
    <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
        <h2 className="text-lg font-bold text-pfi-heading">Proyeksi Ilustrasi</h2>

        <div className="flex items-center gap-2 rounded-[10px] border border-pfi-line bg-white p-1">
          {SCENARIOS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setScenario(item)}
              aria-pressed={scenario === item}
              className={cn(
                "rounded-[8px] px-4 py-2 text-sm font-medium transition",
                scenario === item
                  ? "bg-pfi-link text-white"
                  : "text-pfi-heading hover:bg-pfi-hairline"
              )}
            >
              {LABEL[item]}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-1 rounded-[10px] bg-pfi-bg px-4 py-3 text-sm text-pfi-muted">
          <p>
            Dana:{" "}
            {proyeksi.funds
              .map((fund) => `${fund.name} ${Math.round(fund.portion * 100)}%`)
              .join(" · ")}
          </p>
          {Math.abs(totalAlokasi - 1) > 0.001 && (
            <p className="font-medium text-pfi-down-fg">
              Total alokasi {Math.round(totalAlokasi * 100)}% — proyeksi memakai porsi apa adanya.
            </p>
          )}
          {tanpaTarif.length > 0 && (
            <p className="font-medium text-pfi-down-fg">
              Belum dihitung: {tanpaTarif.join(", ")} — tabel tarifnya tidak ada di MSL.xlsm.
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          {/* Susunan kolom mengikuti sheet `output` di workbook. */}
          <table className="w-full min-w-[1180px] border-collapse text-right text-sm">
            <thead>
              <tr className="bg-pfi-thead">
                {[
                  "Tahun",
                  "Usia",
                  "Premi",
                  "Top Up Berkala",
                  "Top Up Sekaligus",
                  "Penarikan",
                  "Bonus Loyalitas",
                  "Biaya Asuransi",
                  "Biaya Rider",
                  "Nilai Dana",
                  "Santunan Meninggal",
                  "Nilai Tunai",
                ].map((judul, index) => (
                  <th
                    key={judul}
                    className={cn(
                      "px-3 py-3 font-semibold text-pfi-heading",
                      index < 2 && "text-left"
                    )}
                  >
                    {judul}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {baris.map((tahun) => {
                const nilai = tahun.scenarios[scenario];

                return (
                  <tr key={tahun.policyYear} className="border-b border-pfi-hairline">
                    <td className="px-3 py-3 text-left text-pfi-heading">{tahun.policyYear}</td>
                    <td className="px-3 py-3 text-left text-pfi-heading">{tahun.insuredAge}</td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(tahun.basicPremium)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(tahun.regularTopUp)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(tahun.singleTopUp)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(tahun.withdrawal)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(tahun.loyaltyBonus)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-muted">
                      {rupiah(tahun.coiBasic)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-muted">
                      {rupiah(tahun.coiRiders)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 font-medium tabular-nums",
                        nilai.fundEnd < 0 ? "text-pfi-down-fg" : "text-pfi-heading"
                      )}
                    >
                      {rupiah(nilai.fundEnd)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(nilai.deathBenefit)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-pfi-heading">
                      {rupiah(Math.max(nilai.surrenderValue, 0))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {proyeksi.years.length > 10 && (
          <button
            type="button"
            onClick={() => setSemua((prev) => !prev)}
            className="mx-auto rounded-[10px] border border-pfi-link bg-white px-5 py-2.5 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
          >
            {semua
              ? "Tampilkan 10 tahun pertama"
              : `Tampilkan seluruh ${proyeksi.years.length} tahun`}
          </button>
        )}
      </div>
    </section>
  );
}
