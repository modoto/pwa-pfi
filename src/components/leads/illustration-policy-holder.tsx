"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import {
  Field,
  PERSON_FIELD_KEYS,
  PERSON_REQUIRED,
  PersonForm,
  inputClass,
  selectClass,
  type PersonOptions,
} from "@/components/leads/illustration-person-form";
import {
  HUBUNGAN_PEMEGANG_POLIS,
  ILLUSTRATION_PURPOSES,
} from "@/lib/illustration-data";
import { getLead } from "@/lib/db/leads-repo";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";
import { listFieldOptions } from "@/lib/db/master-repo";

const STEP = "policy-holder";

/** Awalan field calon tertanggung; pemegang polis disimpan tanpa awalan. */
const CT = "ct_";

/**
 * Langkah pertama Sales Illustration: tujuan ilustrasi, Data Pemegang Polis,
 * dan — untuk tujuan "Keluarga" — Data Calon Tertanggung.
 *
 * Data pemegang polis diisi awal dari data lead dan tetap bisa diubah agen;
 * data calon tertanggung dibiarkan kosong karena orangnya berbeda. Setiap isian
 * disimpan begitu selesai diketik atau dipilih; menekan "Selanjutnya" menyimpan
 * sekali lagi agar nilai bawaan ikut tercatat.
 */
export function IllustrationPolicyHolder({
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
  const [options, setOptions] = useState<PersonOptions>({
    statusPerkawinan: [],
    pekerjaan: [],
    tujuanAsuransi: [],
  });

  const detailHref = `/leads/details/${leadId}`;

  const load = useCallback(async () => {
    try {
      const [lead, saved, statusPerkawinan, pekerjaan, tujuanAsuransi] = await Promise.all([
        getLead(leadId),
        loadStep(leadId, STEP),
        // Pilihan dropdown dari tabel lokal `msfields`, bukan dari API.
        listFieldOptions(PERSON_FIELD_KEYS.statusPerkawinan),
        listFieldOptions(PERSON_FIELD_KEYS.pekerjaan),
        listFieldOptions(PERSON_FIELD_KEYS.tujuanAsuransi),
      ]);

      setOptions({ statusPerkawinan, pekerjaan, tujuanAsuransi });

      // Isian yang sudah tersimpan menang atas data lead.
      setValues({
        tujuan_ilustrasi: "diri-sendiri",
        nama_depan: lead?.nama_depan ?? "",
        nama_tengah: lead?.nama_tengah ?? "",
        nama_belakang: lead?.nama_belakang ?? "",
        tanggal_lahir: lead?.tanggal_lahir ?? "",
        jenis_kelamin: lead?.jenis_kelamin ?? "",
        ...saved,
      });
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

  const value = (field: string) => values[field] ?? "";

  function ubah(field: string, nilai: string) {
    setValues((prev) => ({ ...prev, [field]: nilai }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  async function simpan(fields: Record<string, string>) {
    try {
      await saveStep(leadId, STEP, fields, agentName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.");
    }
  }

  /** Dipakai select dan radio: ubah lalu langsung simpan. */
  function pilih(field: string, nilai: string) {
    ubah(field, nilai);
    void simpan({ [field]: nilai });
  }

  const tujuan = value("tujuan_ilustrasi");
  const perusahaan = tujuan === "perusahaan";
  // Keluarga dan Perusahaan sama-sama punya kartu Data Calon Tertanggung;
  // bedanya pemegang polis Perusahaan hanya berupa nama badan usaha.
  const punyaTertanggung = tujuan === "keluarga" || perusahaan;

  async function goNext() {
    const found: Record<string, string> = {};

    if (perusahaan) {
      if (!value("nama_lembaga").trim()) {
        found.nama_lembaga = "Nama lembaga / badan usaha wajib diisi.";
      }
    } else {
      for (const { field, label } of PERSON_REQUIRED) {
        if (!value(field).trim()) found[field] = `${label} wajib diisi.`;
      }
    }

    if (punyaTertanggung) {
      if (!value("hubungan").trim()) {
        found.hubungan = "Hubungan dengan pemegang polis wajib dipilih.";
      }
      for (const { field, label } of PERSON_REQUIRED) {
        if (!value(`${CT}${field}`).trim()) found[`${CT}${field}`] = `${label} wajib diisi.`;
      }
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    await simpan(values);
    router.push(`${detailHref}/sales-illustration/product`);
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={detailHref} title="Ilustrasi" />
      <IllustrationStepper current={STEP} leadId={leadId} />

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      {state === "loading" ? (
        <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
      ) : (
        <>
          <section className="flex flex-col gap-4 border-b border-dashed border-pfi-line pb-6">
            <h2 className="text-lg font-bold text-pfi-heading">Tujuan Ilustrasi</h2>

            <div className="grid gap-6 lg:grid-cols-3">
              {ILLUSTRATION_PURPOSES.map(({ key, title, description, icon: Icon }) => {
                const dipilih = tujuan === key;

                return (
                  <label
                    key={key}
                    className={cn(
                      "flex cursor-pointer items-center gap-4 rounded-[14px] border p-4 transition",
                      dipilih
                        ? "border-pfi-link bg-pfi-tint-alt"
                        : "border-pfi-hairline bg-white hover:bg-pfi-hairline"
                    )}
                  >
                    <input
                      type="radio"
                      name="tujuan_ilustrasi"
                      value={key}
                      checked={dipilih}
                      onChange={() => pilih("tujuan_ilustrasi", key)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "grid size-12 shrink-0 place-items-center rounded-[10px]",
                        dipilih ? "bg-pfi-link text-white" : "bg-pfi-tint text-pfi-link"
                      )}
                    >
                      <Icon className="size-6" aria-hidden />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-base font-bold text-pfi-heading">{title}</span>
                      <span className="text-sm text-pfi-muted">{description}</span>
                    </span>

                    <span
                      aria-hidden
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-2",
                        dipilih ? "border-pfi-link" : "border-pfi-line"
                      )}
                    >
                      {dipilih && <span className="size-2.5 rounded-full bg-pfi-link" />}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
                <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
                  <h2 className="text-lg font-bold text-pfi-heading">Data Pemegang Polis</h2>
                </header>

                {perusahaan ? (
                  <div className="p-4 sm:p-6">
                    <Field
                      label="Nama Lembaga / Badan Usaha"
                      required
                      error={errors.nama_lembaga}
                    >
                      <input
                        value={value("nama_lembaga")}
                        onChange={(event) => ubah("nama_lembaga", event.target.value)}
                        onBlur={() => void simpan({ nama_lembaga: value("nama_lembaga") })}
                        className={cn(inputClass, errors.nama_lembaga && "border-pfi-down-fg")}
                      />
                    </Field>
                  </div>
                ) : (
                  <PersonForm
                    prefix=""
                    values={values}
                    errors={errors}
                    onChange={ubah}
                    onSave={(field) => void simpan({ [field]: value(field) })}
                    onPick={pilih}
                    options={options}
                  />
                )}
              </section>

              {punyaTertanggung && (
                <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
                  <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
                    <h2 className="text-lg font-bold text-pfi-heading">Data Calon Tertanggung</h2>
                  </header>

                  <div className="px-4 pt-4 sm:px-6 sm:pt-6">
                    <Field
                      label="Hubungan Dengan Pemegang Polis"
                      required
                      error={errors.hubungan}
                    >
                      <select
                        value={value("hubungan")}
                        onChange={(event) => pilih("hubungan", event.target.value)}
                        className={cn(selectClass, errors.hubungan && "border-pfi-down-fg")}
                      >
                        <option value="">Pilih hubungan</option>
                        {HUBUNGAN_PEMEGANG_POLIS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <PersonForm
                    prefix={CT}
                    values={values}
                    errors={errors}
                    onChange={ubah}
                    onSave={(field) => void simpan({ [field]: value(field) })}
                    onPick={pilih}
                    options={options}
                  />
                </section>
              )}
        </>
      )}

      <FnaFooter backHref={detailHref} onNext={() => void goNext()} />
    </div>
  );
}
