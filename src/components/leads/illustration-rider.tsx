"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { MasterMissing } from "@/components/master-missing";
import { TAHUN_KE, langkahTetangga } from "@/lib/illustration-data";
import { RIDER_TANPA_UP, riderEngineKey, riderKey } from "@/lib/rider-data";
import { buildMslInput } from "@/lib/calc/msl-input";
import { firstYearRiderCostsFor, unitLinkProductOf } from "@/lib/calc/unit-link";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";
import {
  getProductSetup,
  listDisallowedRiders,
  listProductRiders,
  parseList,
  type MasterRider,
} from "@/lib/db/master-repo";

const STEP = "rider";

const cellClass =
  "w-full rounded-[10px] border border-pfi-line bg-white px-3.5 py-3 text-sm text-pfi-heading " +
  "outline-none transition placeholder:text-pfi-search " +
  "focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15 " +
  "disabled:cursor-not-allowed disabled:bg-pfi-hairline disabled:text-pfi-subtle";

const digitsOf = (value: string) => value.replace(/\D/g, "");
const formatRibuan = (value: string) => (value ? Number(value).toLocaleString("id-ID") : "");
const rupiahTeks = (nilai: number) => `Rp ${Math.round(nilai).toLocaleString("id-ID")}`;
const angkaMaster = (nilai: string | null | undefined) =>
  nilai === null || nilai === undefined || nilai === "" ? null : Number(nilai);

/** Rider dari master beserta kunci field-nya di `lead_illustration_fields`. */
type RiderBaris = MasterRider & { key: string };

/**
 * Keadaan daftar rider: rider baru bisa ditampilkan setelah produk dipilih
 * dan setup produknya ada di master.
 */
type DaftarRider =
  | { status: "ok"; riders: RiderBaris[] }
  | { status: "tanpa-produk" }
  | { status: "tanpa-setup" }
  | { status: "master-belum-ditarik" };

/** Kotak centang bergaya desain; input aslinya disembunyikan. */
function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-6 place-items-center rounded-[6px] border-2 transition",
          checked ? "border-pfi-link bg-pfi-link text-white" : "border-pfi-line bg-white"
        )}
      >
        {checked && (
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor">
            <path d="M3 8.5 6.5 12 13 4.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </label>
  );
}

/**
 * Langkah ketiga Sales Illustration: pilihan rider.
 *
 * Daftar rider, batas uang pertanggungan, pilihan masa, dan pasangan rider
 * yang tidak boleh diambil bersamaan semuanya dibaca dari tabel master lokal
 * (`ps_riders`, `riders`, `disallowed_riders`) sesuai produk yang dipilih di
 * langkah Rincian Produk. Kolom Premi menampilkan biaya rider per bulan pada
 * tahun pertama dari mesin hitung MSL.
 */
export function IllustrationRider({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [daftar, setDaftar] = useState<DaftarRider>({ status: "tanpa-produk" });
  // id rider → id rider lain yang tidak boleh diambil bersamaan (dua arah).
  const [larangan, setLarangan] = useState<Map<string, Set<string>>>(new Map());
  // Isian langkah lain, untuk menghitung premi rider.
  const [langkahLain, setLangkahLain] = useState<{
    policyHolder: Record<string, string>;
    product: Record<string, string>;
  }>({ policyHolder: {}, product: {} });

  const detailHref = `/leads/details/${leadId}`;
  const backHref = `${detailHref}/sales-illustration/product`;

  const load = useCallback(async () => {
    try {
      const [saved, product, policyHolder, pasangan] = await Promise.all([
        loadStep(leadId, STEP),
        loadStep(leadId, "product"),
        loadStep(leadId, "policy-holder"),
        listDisallowedRiders(),
      ]);

      const peta = new Map<string, Set<string>>();
      for (const [a, b] of pasangan) {
        if (!peta.has(a)) peta.set(a, new Set());
        if (!peta.has(b)) peta.set(b, new Set());
        peta.get(a)?.add(b);
        peta.get(b)?.add(a);
      }

      let hasil: DaftarRider;
      if (!product.produk_id) {
        hasil = { status: "tanpa-produk" };
      } else {
        const setup = await getProductSetup(product.produk_id);
        const riders = setup ? await listProductRiders(setup.id) : null;
        hasil = !setup
          ? { status: "tanpa-setup" }
          : riders === null
            ? { status: "master-belum-ditarik" }
            : {
                status: "ok",
                riders: riders.map((rider) => ({
                  ...rider,
                  key: riderKey(rider.rider_code ?? rider.id),
                })),
              };
      }

      setValues(saved);
      setLarangan(peta);
      setDaftar(hasil);
      setLangkahLain({ policyHolder, product });
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const riders = useMemo(() => (daftar.status === "ok" ? daftar.riders : []), [daftar]);

  const value = (field: string) => values[field] ?? "";
  const dipilih = (key: string) => value(`${key}_dipilih`) === "Ya";
  const tanpaUp = (rider: MasterRider) => {
    const mesin = riderEngineKey(rider.description);
    return mesin !== null && RIDER_TANPA_UP.has(mesin);
  };

  /** Rider lain yang sudah dicentang dan tidak boleh diambil bersama `rider`. */
  function bentrok(rider: RiderBaris, terpilih: (key: string) => boolean): RiderBaris | null {
    const dilarang = larangan.get(String(rider.id));
    if (!dilarang) return null;
    return riders.find((lain) => dilarang.has(String(lain.id)) && terpilih(lain.key)) ?? null;
  }

  // Biaya rider tahun pertama per komponen mesin; kosong bila data belum cukup.
  const biayaRider = useMemo(() => {
    const input = buildMslInput({
      policyHolder: langkahLain.policyHolder,
      product: langkahLain.product,
      rider: values,
      investment: {},
    });
    return input
      ? firstYearRiderCostsFor(unitLinkProductOf(langkahLain.product.nama_produk), input)
      : {};
  }, [langkahLain, values]);

  async function simpan(fields: Record<string, string>) {
    try {
      await saveStep(leadId, STEP, fields, agentName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.");
    }
  }

  function ubah(field: string, nilai: string) {
    setValues((prev) => ({ ...prev, [field]: nilai }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function pilih(field: string, nilai: string) {
    ubah(field, nilai);
    void simpan({ [field]: nilai });
  }

  /** Field satu rider saat dicentang / dicabut. */
  function fieldsRider(rider: RiderBaris, checked: boolean): Record<string, string> {
    return checked
      ? {
          [`${rider.key}_dipilih`]: "Ya",
          // Nama dan kode ikut disimpan untuk Kutipan Ilustrasi dan RIPLAY.
          [`${rider.key}_nama`]: rider.rider_name ?? "",
          [`${rider.key}_kode`]: rider.description ?? "",
        }
      : {
          [`${rider.key}_dipilih`]: "",
          [`${rider.key}_up`]: "",
          [`${rider.key}_masa`]: "",
        };
  }

  function centang(rider: RiderBaris, checked: boolean) {
    const fields = fieldsRider(rider, checked);
    setValues((prev) => ({ ...prev, ...fields }));
    setErrors({});
    void simpan(fields);
  }

  const semua = riders.length > 0 && riders.every((rider) => dipilih(rider.key));

  /** Centang semua melewati rider yang bentrok dengan rider yang sudah terpilih. */
  function centangSemua(checked: boolean) {
    const terpilih = new Set(checked ? riders.filter((r) => dipilih(r.key)).map((r) => r.key) : []);
    const fields: Record<string, string> = {};

    for (const rider of riders) {
      if (checked) {
        if (terpilih.has(rider.key) || bentrok(rider, (key) => terpilih.has(key))) continue;
        terpilih.add(rider.key);
      }
      Object.assign(fields, fieldsRider(rider, checked));
    }

    setValues((prev) => ({ ...prev, ...fields }));
    setErrors({});
    void simpan(fields);
  }

  async function goNext() {
    const found: Record<string, string> = {};

    // Rider boleh tidak diambil sama sekali; yang dicentang harus lengkap.
    for (const rider of riders) {
      if (!dipilih(rider.key)) continue;

      const upField = `${rider.key}_up`;
      if (!tanpaUp(rider)) {
        const up = Number(value(upField)) || 0;
        const min = angkaMaster(rider.min_sum_assured);
        const max = angkaMaster(rider.max_sum_assured);

        if (!up) found[upField] = "Uang pertanggungan wajib diisi.";
        else if (min !== null && up < min) found[upField] = `Minimal ${rupiahTeks(min)}.`;
        else if (max !== null && up > max) found[upField] = `Maksimal ${rupiahTeks(max)}.`;
      }

      if (!value(`${rider.key}_masa`)) {
        found[`${rider.key}_masa`] = "Masa pertanggungan wajib dipilih.";
      }

      const lain = bentrok(rider, dipilih);
      if (lain) {
        found[`${rider.key}_dipilih`] = `Tidak bisa diambil bersama ${lain.rider_name}.`;
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    await simpan(values);
    // Produk tradisional melewati Kuesioner Profil Resiko dan Pilihan Investasi.
    const berikut = langkahTetangga(STEP, langkahLain.product.jenis_produk, 1) ?? "quotation";
    router.push(`${detailHref}/sales-illustration/${berikut}`);
  }

  const kosong = (judul: string, isi: string) => (
    <section className="flex flex-col items-center gap-3 rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
      <p className="text-base font-bold text-pfi-heading">{judul}</p>
      <p className="max-w-[520px] text-sm text-pfi-muted">{isi}</p>
    </section>
  );

  function isi() {
    if (daftar.status === "tanpa-produk") {
      return kosong(
        "Produk belum dipilih",
        "Pilih produk di langkah Rincian Produk dulu — daftar rider mengikuti produknya."
      );
    }
    if (daftar.status === "tanpa-setup") {
      return kosong(
        "Setup produk tidak ditemukan",
        "Produk terpilih belum punya setup di master data lokal. Tarik ulang master data dari halaman Profil."
      );
    }
    if (daftar.status === "master-belum-ditarik") return <MasterMissing label="rider" />;
    if (riders.length === 0) {
      return kosong("Tidak ada rider", "Produk ini tidak menawarkan rider. Lanjutkan ke langkah berikutnya.");
    }

    return (
      <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
        <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
          <h2 className="text-lg font-bold text-pfi-heading">Rider</h2>
        </header>

        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-pfi-bg">
                <th className="w-14 rounded-l-[10px] px-4 py-4">
                  <Checkbox checked={semua} onChange={centangSemua} label="Pilih semua rider" />
                </th>
                <th className="px-4 py-4 text-base font-medium text-pfi-heading">Nama Rider</th>
                <th className="px-4 py-4 text-base font-medium text-pfi-heading">
                  Uang Pertanggungan
                </th>
                <th className="px-4 py-4 text-base font-medium text-pfi-heading">Premi</th>
                <th className="rounded-r-[10px] px-4 py-4 text-base font-medium text-pfi-heading">
                  Masa Pertanggungan
                </th>
              </tr>
            </thead>

            <tbody>
              {riders.map((rider) => {
                const aktif = dipilih(rider.key);
                const nama = rider.rider_name ?? rider.description ?? rider.key;
                const upField = `${rider.key}_up`;
                const masaField = `${rider.key}_masa`;
                const pilihUp = !tanpaUp(rider);
                const lain = aktif ? null : bentrok(rider, dipilih);
                const mesin = riderEngineKey(rider.description);
                const biaya = aktif && mesin ? biayaRider[mesin] : undefined;
                const minUp = angkaMaster(rider.min_sum_assured);
                const masa = parseList(rider.policy_term);
                const pilihanMasa = masa.length > 0 ? masa : TAHUN_KE;

                return (
                  <tr key={rider.key} className="border-b border-pfi-hairline last:border-b-0">
                    <td className="px-4 py-5 align-top">
                      <Checkbox
                        checked={aktif}
                        disabled={Boolean(lain)}
                        onChange={(checked) => centang(rider, checked)}
                        label={nama}
                      />
                    </td>

                    <td className="px-4 py-5 align-top">
                      <p className="text-base font-bold text-pfi-heading">{nama}</p>
                      {lain && (
                        <p className="mt-1 text-xs text-pfi-muted">
                          Tidak bisa diambil bersama {lain.rider_name}.
                        </p>
                      )}
                      {errors[`${rider.key}_dipilih`] && (
                        <p className="mt-1 text-xs font-medium text-pfi-down-fg">
                          {errors[`${rider.key}_dipilih`]}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-5 align-top">
                      <input
                        inputMode="numeric"
                        value={pilihUp ? formatRibuan(value(upField)) : ""}
                        disabled={!aktif || !pilihUp}
                        placeholder={
                          pilihUp ? (minUp !== null ? `Min. ${formatRibuan(String(minUp))}` : "–") : "Mengikuti premi"
                        }
                        aria-label={`Uang pertanggungan ${nama}`}
                        onChange={(event) => ubah(upField, digitsOf(event.target.value))}
                        onBlur={() => void simpan({ [upField]: value(upField) })}
                        className={cn(cellClass, errors[upField] && "border-pfi-down-fg")}
                      />
                      {errors[upField] && (
                        <p className="mt-1.5 text-xs font-medium text-pfi-down-fg">
                          {errors[upField]}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-5 align-top">
                      <input
                        value={biaya ? `${rupiahTeks(biaya / 12)} /bln` : ""}
                        readOnly
                        disabled
                        placeholder={aktif && !mesin ? "Belum ada tarif" : "–"}
                        title={
                          aktif && !mesin
                            ? "Tarif rider ini tidak ada di MSL.xlsm"
                            : "Biaya rider per bulan pada tahun polis pertama"
                        }
                        aria-label={`Premi ${nama}`}
                        className={cellClass}
                      />
                    </td>

                    <td className="px-4 py-5 align-top">
                      <select
                        value={value(masaField)}
                        disabled={!aktif}
                        aria-label={`Masa pertanggungan ${nama}`}
                        onChange={(event) => pilih(masaField, event.target.value)}
                        className={cn(
                          cellClass,
                          "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12",
                          errors[masaField] && "border-pfi-down-fg"
                        )}
                      >
                        <option value="">–</option>
                        {value(masaField) && !pilihanMasa.includes(value(masaField)) && (
                          <option value={value(masaField)}>{value(masaField)} Tahun</option>
                        )}
                        {pilihanMasa.map((tahun) => (
                          <option key={tahun} value={tahun}>
                            {tahun} Tahun
                          </option>
                        ))}
                      </select>
                      {errors[masaField] && (
                        <p className="mt-1.5 text-xs font-medium text-pfi-down-fg">
                          {errors[masaField]}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={backHref} title="Ilustrasi" />
      <IllustrationStepper current={STEP} leadId={leadId} />

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : (
        isi()
      )}

      <FnaFooter backHref={backHref} onNext={() => void goNext()} />
    </div>
  );
}
