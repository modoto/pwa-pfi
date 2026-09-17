"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { Field, inputClass, selectClass } from "@/components/leads/illustration-person-form";
import { JENIS_PRODUK, TAHUN_KE } from "@/lib/illustration-data";
import { hitungUsia } from "@/lib/lead-form-data";
import { ropPayMode, ropPremiumTerms, ropProductOf } from "@/lib/calc/rop-engine";
import {
  DASAR_HITUNG,
  duaArahTersedia,
  hitungDuaArah,
  type DasarHitung,
  type TwoWayContext,
} from "@/lib/calc/two-way";
import { JENIS_PRODUK_API, namaProduk } from "@/lib/products-data";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";
import {
  getProductSetup,
  listMinimumIndicators,
  listProducts,
  parseList,
  type MasterMinimumIndicator,
  type MasterProduct,
  type MasterProductSetup,
} from "@/lib/db/master-repo";

const STEP = "product";

/** Isian yang bergantung pada setup produk; dikosongkan saat produk berganti. */
const KOSONG_SETUP = {
  mata_uang: "",
  cara_bayar: "",
  masa_pembayaran: "",
  masa_pertanggungan: "",
  // Dasar hitung kembali ke bawaan produk yang baru.
  dasar_hitung: "",
};

/** Setup produk + premi minimumnya, dibaca dari tabel lokal. */
type SetupProduk = { setup: MasterProductSetup; minimum: MasterMinimumIndicator[] };

async function muatSetup(productId: string): Promise<SetupProduk | null> {
  if (!productId) return null;
  const setup = await getProductSetup(productId);
  if (!setup) return null;
  return { setup, minimum: await listMinimumIndicators(setup.id) };
}

/** Angka dari kolom master (disimpan sebagai teks); kosong = tidak dibatasi. */
const angkaMaster = (nilai: string | null | undefined) =>
  nilai === null || nilai === undefined || nilai === "" ? null : Number(nilai);

const rupiahTeks = (nilai: number) => `Rp ${nilai.toLocaleString("id-ID")}`;

/** "3 Tahun" ↔ 3 — master menyimpan masa sebagai angka tahun. */
const keTahun = (daftar: string[]) => daftar.map((nilai) => `${nilai} Tahun`);
const angkaTahun = (teks: string) => /(\d+)/.exec(teks)?.[1] ?? "";

/** Satu baris top up berkala atau penarikan. */
type Entry = { tahun: string; jumlah: string };

const emptyEntry = (): Entry => ({ tahun: "", jumlah: "" });

/** Nilai uang disimpan sebagai angka polos; titik ribuan hanya untuk tampilan. */
const digitsOf = (value: string) => value.replace(/\D/g, "");
const formatRibuan = (value: string) =>
  value ? Number(value).toLocaleString("id-ID") : "";

function parseEntries(raw: string): Entry[] {
  if (!raw) return [emptyEntry()];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [emptyEntry()];

    return parsed.map((item) => ({
      tahun: String((item as Entry)?.tahun ?? ""),
      jumlah: String((item as Entry)?.jumlah ?? ""),
    }));
  } catch {
    return [emptyEntry()];
  }
}

/**
 * Langkah kedua Sales Illustration: Rincian Produk.
 *
 * Top Up Berkala, Top Up Tunggal, dan Penarikan hanya berlaku untuk produk
 * Unit Link; memilih Tradisional menyisakan kartu Detail Produk saja.
 *
 * Daftar berulang disimpan sebagai satu field berisi JSON — tabel isian
 * ilustrasi berbentuk kunci-nilai, jadi jumlah barisnya tidak dibatasi skema.
 */
export function IllustrationProduct({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>({});
  const [berkala, setBerkala] = useState<Entry[]>([emptyEntry()]);
  const [penarikan, setPenarikan] = useState<Entry[]>([emptyEntry()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  // `null` = master produk belum pernah ditarik ke database lokal.
  const [products, setProducts] = useState<MasterProduct[] | null>([]);
  // Setup produk terpilih dari `product_setups`; `null` = produk belum
  // dipilih atau setup-nya tidak ada di master.
  const [setupProduk, setSetupProduk] = useState<SetupProduk | null>(null);
  // Usia dari langkah Rincian PP dan CT, untuk memeriksa batas usia produk.
  const [usia, setUsia] = useState<{ tertanggung: number | null; pemegangPolis: number | null }>({
    tertanggung: null,
    pemegangPolis: null,
  });

  const detailHref = `/leads/details/${leadId}`;

  const load = useCallback(async () => {
    try {
      const [saved, masterProduk, pemegangPolis] = await Promise.all([
        loadStep(leadId, STEP),
        listProducts(),
        loadStep(leadId, "policy-holder"),
      ]);
      setProducts(masterProduk);
      setSetupProduk(await muatSetup(saved.produk_id ?? ""));

      // Untuk tujuan "Keluarga"/"Perusahaan" tertanggungnya orang lain.
      const usiaDari = (tanggal: string | undefined) => Number(hitungUsia(tanggal ?? "")) || null;
      setUsia({
        tertanggung: usiaDari(pemegangPolis.ct_tanggal_lahir || pemegangPolis.tanggal_lahir),
        pemegangPolis:
          pemegangPolis.tujuan_ilustrasi === "perusahaan"
            ? null
            : usiaDari(pemegangPolis.tanggal_lahir),
      });

      setValues({ jenis_produk: "Unit Link", ...saved });
      setBerkala(parseEntries(saved.top_up_berkala ?? ""));
      setPenarikan(parseEntries(saved.penarikan ?? ""));
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
    // Ganti cara bayar / masa pembayaran mengubah premi tahunan, jadi sisi yang
    // dikunci dihitung ulang.
    const turunan =
      field === "cara_bayar" || field === "masa_pembayaran" ? hitungPasangan({ [field]: nilai }) : {};

    ubah(field, nilai);
    if (Object.keys(turunan).length) setValues((prev) => ({ ...prev, ...turunan }));
    void simpan({ [field]: nilai, ...turunan });
  }

  /** Nama produk mengikuti jenis produk, jadi pilihan lama ikut dikosongkan. */
  function pilihJenis(jenis: string) {
    const fields = { jenis_produk: jenis, produk_id: "", nama_produk: "", ...KOSONG_SETUP };
    setValues((prev) => ({ ...prev, ...fields }));
    setErrors((prev) => ({ ...prev, jenis_produk: "", nama_produk: "" }));
    setSetupProduk(null);
    void simpan(fields);
  }

  /**
   * Produk disimpan sebagai id master (`produk_id`) sekaligus nama tampilannya
   * (`nama_produk`), karena Kutipan Ilustrasi dan RIPLAY membaca namanya.
   */
  async function pilihProduk(id: string) {
    const product = products?.find((item) => item.id === id);
    const setupBaru = await muatSetup(id);

    // Cara bayar dan masa milik produk lama belum tentu berlaku untuk produk
    // baru, jadi dikosongkan. Mata uang langsung terisi karena tiap setup
    // hanya punya satu.
    const fields: Record<string, string> = {
      produk_id: id,
      nama_produk: product ? namaProduk(product) : "",
      ...KOSONG_SETUP,
      mata_uang: setupBaru?.setup.currency ?? "",
    };

    setSetupProduk(setupBaru);
    setValues((prev) => ({ ...prev, ...fields }));
    setErrors((prev) => ({ ...prev, nama_produk: "", usia: "" }));
    void simpan(fields);
  }

  const jenis = value("jenis_produk");
  const unitLink = jenis === "Unit Link";
  // Jenis di API ditulis "UnitLink" / "Tradisional"; di formulir "Unit Link".
  const produkPilihan = (products ?? []).filter(
    (product) => JENIS_PRODUK_API[product.product_type ?? ""] === jenis
  );

  const setup = setupProduk?.setup ?? null;

  /**
   * Hitung dua arah antara Uang Pertanggungan dan Premi Dasar: agen memilih
   * salah satu lewat radio, satunya dikunci dan diisi otomatis. Rumusnya per
   * produk, ada di src/lib/calc/two-way.ts.
   */
  function konteksDuaArah(v: Record<string, string>): TwoWayContext {
    const caraBayar = v.cara_bayar ?? "";
    return {
      namaProduk: v.nama_produk ?? "",
      jenisProduk: v.jenis_produk ?? "",
      caraBayar,
      masaBayar: /sekaligus/i.test(caraBayar) ? 1 : Number(angkaTahun(v.masa_pembayaran ?? "")) || 0,
      usiaTertanggung: usia.tertanggung ?? 0,
      minSumAssured: angkaMaster(setup?.min_sum_assured),
    };
  }

  /**
   * Bawaan dasar hitung mengikuti master: produk yang `isSumAssuredEditable`
   * bernilai false (mis. MAML) diisi dari premi, sisanya dari UP.
   */
  const dasarBawaan: DasarHitung = ["0", "false"].includes(
    String(setup?.is_sum_assured_editable ?? "")
  )
    ? "premi_dasar"
    : "uang_pertanggungan";

  const dasar: DasarHitung = DASAR_HITUNG.includes(value("dasar_hitung") as DasarHitung)
    ? (value("dasar_hitung") as DasarHitung)
    : dasarBawaan;

  const duaArah = Boolean(value("produk_id")) && duaArahTersedia(konteksDuaArah(values));

  /** Nilai baru untuk isian yang dikunci, mengikuti isian yang jadi dasar. */
  function hitungPasangan(ubahan: Record<string, string> = {}): Record<string, string> {
    const v = { ...values, ...ubahan };
    if (!v.produk_id) return {};

    const konteks = konteksDuaArah(v);
    if (!duaArahTersedia(konteks)) return {};

    const dasarKini = DASAR_HITUNG.includes(v.dasar_hitung as DasarHitung)
      ? (v.dasar_hitung as DasarHitung)
      : dasarBawaan;

    const hasil = hitungDuaArah(konteks, dasarKini, {
      uangPertanggungan: Number(v.uang_pertanggungan) || 0,
      premiDasar: Number(v.premi_dasar) || 0,
    });
    if (!hasil) return {};

    if (hasil.uangPertanggungan !== undefined) {
      return { uang_pertanggungan: String(hasil.uangPertanggungan) };
    }
    if (hasil.premiDasar !== undefined) return { premi_dasar: String(hasil.premiDasar) };
    return {};
  }

  /** Keterangan rumus, ditampilkan di bawah isian yang dikunci. */
  const keteranganDuaArah = duaArah
    ? (hitungDuaArah(konteksDuaArah(values), dasar, {
        uangPertanggungan: Number(value("uang_pertanggungan")) || 0,
        premiDasar: Number(value("premi_dasar")) || 0,
      })?.keterangan ?? "")
    : "";

  /** Pindah dasar hitung: isian yang baru dikunci langsung dihitung ulang. */
  function pilihDasar(field: DasarHitung) {
    const turunan = hitungPasangan({ dasar_hitung: field });
    const fields = { dasar_hitung: field, ...turunan };

    setValues((prev) => ({ ...prev, ...fields }));
    setErrors((prev) => ({ ...prev, uang_pertanggungan: "", premi_dasar: "" }));
    void simpan(fields);
  }

  /**
   * Pilihan dropdown mengikuti setup produk di master; `null` mengunci
   * dropdown-nya dengan alasan, bukan menampilkan daftar karangan. Sebagian
   * produk baru (mis. MAMS, MSP) setup-nya masih kosong di master.
   */
  const isi = (daftar: string[]) => (setup && daftar.length > 0 ? daftar : null);
  const pilihanSetup = {
    mataUang: isi(setup?.currency ? [setup.currency] : []),
    caraBayar: isi(parseList(setup?.payment_mode)),
    masaPembayaran: isi(keTahun(parseList(setup?.premium_term))),
    masaPertanggungan: isi(keTahun(parseList(setup?.policy_term))),
  };
  const alasanKunci = !value("produk_id")
    ? "Pilih produk terlebih dahulu"
    : !setup
      ? "Setup produk belum ada di master data"
      : "Belum diatur di master data";

  function ubahEntry(
    list: Entry[],
    setList: (next: Entry[]) => void,
    field: string,
    index: number,
    key: keyof Entry,
    nilai: string
  ) {
    const next = list.map((entry, i) => (i === index ? { ...entry, [key]: nilai } : entry));
    setList(next);
    setErrors((prev) => ({ ...prev, [`${field}_${index}_${key}`]: "" }));
    void simpan({ [field]: JSON.stringify(next) });
  }

  function hapusEntry(
    list: Entry[],
    setList: (next: Entry[]) => void,
    field: string,
    index: number
  ) {
    // Satu baris kosong selalu disisakan, seperti keadaan awal di desain.
    const next = list.filter((_, i) => i !== index);
    const hasil = next.length > 0 ? next : [emptyEntry()];
    setList(hasil);
    setErrors({});
    void simpan({ [field]: JSON.stringify(hasil) });
  }

  function tambahEntry(list: Entry[], setList: (next: Entry[]) => void, field: string) {
    const next = [...list, emptyEntry()];
    setList(next);
    void simpan({ [field]: JSON.stringify(next) });
  }

  async function goNext() {
    const found: Record<string, string> = {};

    const wajib: { field: string; label: string }[] = [
      { field: "jenis_produk", label: "Jenis produk" },
      { field: "nama_produk", label: "Nama produk" },
      { field: "mata_uang", label: "Mata uang" },
      { field: "cara_bayar", label: "Cara bayar" },
      { field: "masa_pembayaran", label: "Masa pembayaran" },
      { field: "masa_pertanggungan", label: "Masa pertanggungan" },
      { field: "uang_pertanggungan", label: "Uang pertanggungan" },
      { field: "premi_dasar", label: "Premi dasar" },
    ];

    for (const { field, label } of wajib) {
      if (!value(field).trim()) found[field] = `${label} wajib diisi.`;
    }

    const bukanPilihan: [string, string[] | null][] = [
      ["mata_uang", pilihanSetup.mataUang],
      ["cara_bayar", pilihanSetup.caraBayar],
      ["masa_pembayaran", pilihanSetup.masaPembayaran],
      ["masa_pertanggungan", pilihanSetup.masaPertanggungan],
    ];
    for (const [field, options] of bukanPilihan) {
      if (found[field] || !value(field)) continue;
      if (options === null) {
        found[field] = "Setup produk belum ada di master data; tarik ulang master di halaman Profil.";
      } else if (!options.includes(value(field))) {
        found[field] = "Pilihan ini tidak berlaku untuk produk terpilih; pilih ulang.";
      }
    }

    if (unitLink) {
      // Top up dan penarikan boleh dikosongkan; yang sudah diisi separuh tidak.
      const periksa = (list: Entry[], field: string) => {
        list.forEach((entry, index) => {
          const adaIsi = entry.tahun || entry.jumlah;
          if (!adaIsi) return;

          if (!entry.tahun) found[`${field}_${index}_tahun`] = "Tahun wajib dipilih.";
          if (!entry.jumlah) found[`${field}_${index}_jumlah`] = "Jumlah wajib diisi.";
        });
      };

      periksa(berkala, "top_up_berkala");
      periksa(penarikan, "penarikan");

      const tunggalTahun = value("top_up_tunggal_tahun");
      const tunggalJumlah = value("top_up_tunggal_jumlah");
      if (tunggalTahun || tunggalJumlah) {
        if (!tunggalTahun) found.top_up_tunggal_tahun = "Tahun wajib dipilih.";
        if (!tunggalJumlah) found.top_up_tunggal_jumlah = "Jumlah wajib diisi.";
      }
    }

    if (setupProduk) periksaBatasProduk(setupProduk, found);

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    await simpan({
      ...values,
      top_up_berkala: JSON.stringify(berkala),
      penarikan: JSON.stringify(penarikan),
    });
    router.push(`${detailHref}/sales-illustration/rider`);
  }

  /**
   * Batas dari master: uang pertanggungan, premi minimum per cara bayar (dan
   * masa pembayaran bila diatur), minimum top up berkala, dan usia masuk.
   */
  function periksaBatasProduk({ setup, minimum }: SetupProduk, found: Record<string, string>) {
    const di_luar = (nilai: number, min: number | null, max: number | null) =>
      (min !== null && nilai < min) || (max !== null && nilai > max);

    const up = Number(value("uang_pertanggungan")) || 0;
    const minUp = angkaMaster(setup.min_sum_assured);
    const maxUp = angkaMaster(setup.max_sum_assured);
    if (!found.uang_pertanggungan && up && di_luar(up, minUp, maxUp)) {
      found.uang_pertanggungan =
        minUp !== null && up < minUp
          ? `Minimal ${rupiahTeks(minUp)}.`
          : `Maksimal ${rupiahTeks(maxUp ?? 0)}.`;
    }

    // Aturan paling spesifik didahulukan. Sebagian baris master tidak mengunci
    // cara bayar maupun masa pembayaran (keduanya null) — itu berlaku umum.
    const caraBayar = value("cara_bayar");
    const masaBayar = angkaTahun(value("masa_pembayaran"));
    const cocokCara = (row: { payment_mode: string | null }) =>
      !row.payment_mode || row.payment_mode === caraBayar;
    const cocokMasa = (row: { premium_term: string | null }) =>
      !row.premium_term || row.premium_term === masaBayar;
    const aturan =
      minimum.find((row) => row.payment_mode === caraBayar && row.premium_term === masaBayar) ??
      minimum.find((row) => row.payment_mode === caraBayar && !row.premium_term) ??
      minimum.find((row) => !row.payment_mode && row.premium_term === masaBayar) ??
      minimum.find((row) => cocokCara(row) && cocokMasa(row));
    const premi = Number(value("premi_dasar")) || 0;
    const minPremi = angkaMaster(aturan?.min_premium);
    const maxPremi = angkaMaster(aturan?.max_premium);
    if (!found.premi_dasar && premi && di_luar(premi, minPremi, maxPremi)) {
      found.premi_dasar =
        minPremi !== null && premi < minPremi
          ? `Minimal ${rupiahTeks(minPremi)} untuk cara bayar ${caraBayar}.`
          : `Maksimal ${rupiahTeks(maxPremi ?? 0)} untuk cara bayar ${caraBayar}.`;
    }

    const minTopUp = angkaMaster(setup.min_regular_topup);
    const maxTopUp = angkaMaster(setup.max_regular_topup);
    if (unitLink) {
      berkala.forEach((entry, index) => {
        const jumlah = Number(entry.jumlah) || 0;
        const key = `top_up_berkala_${index}_jumlah`;
        if (found[key] || !jumlah || !di_luar(jumlah, minTopUp, maxTopUp)) return;
        found[key] =
          minTopUp !== null && jumlah < minTopUp
            ? `Minimal ${rupiahTeks(minTopUp)}.`
            : `Maksimal ${rupiahTeks(maxTopUp ?? 0)}.`;
      });
    }

    // MSP dan MAMS: master membolehkan masa bayar 7–10 untuk semua masa
    // asuransi, sedangkan tabel tarif di workbook hanya punya sebagian.
    const produkRop = ropProductOf(value("nama_produk"));
    if (produkRop) {
      const masaTanggung = Number(angkaTahun(value("masa_pertanggungan"))) || 0;
      const masaBayarKini = Number(angkaTahun(value("masa_pembayaran"))) || 0;
      const boleh = ropPremiumTerms(produkRop, ropPayMode(value("cara_bayar")), masaTanggung);

      if (masaTanggung && masaBayarKini && !boleh.includes(masaBayarKini)) {
        found.masa_pembayaran = `Untuk masa pertanggungan ${masaTanggung} tahun, masa pembayaran yang tersedia di tabel tarif: ${boleh.join(", ")} tahun.`;
      }
    }

    const batas = (min: string | null, max: string | null) =>
      `${min ?? "–"}–${max ?? "–"} tahun`;
    if (
      usia.tertanggung !== null &&
      di_luar(usia.tertanggung, angkaMaster(setup.min_entry_age), angkaMaster(setup.max_entry_age))
    ) {
      found.usia = `Usia calon tertanggung ${usia.tertanggung} tahun di luar batas usia masuk produk ini (${batas(setup.min_entry_age, setup.max_entry_age)}). Periksa langkah Rincian PP dan CT.`;
    } else if (
      usia.pemegangPolis !== null &&
      di_luar(usia.pemegangPolis, angkaMaster(setup.min_age_ph), angkaMaster(setup.max_age_ph))
    ) {
      found.usia = `Usia pemegang polis ${usia.pemegangPolis} tahun di luar batas produk ini (${batas(setup.min_age_ph, setup.max_age_ph)}). Periksa langkah Rincian PP dan CT.`;
    }
  }

  const dropdown = (
    field: string,
    label: string,
    placeholder: string,
    options: string[] | null
  ) => (
    <Field label={label} required error={errors[field]}>
      <select
        value={value(field)}
        onChange={(event) => pilih(field, event.target.value)}
        disabled={options === null}
        className={cn(selectClass, errors[field] && "border-pfi-down-fg")}
      >
        <option value="">{options === null ? alasanKunci : placeholder}</option>
        {/* Nilai lama yang tidak ada di setup tetap tampil, supaya tidak
            diam-diam terbaca kosong; agen tetap diminta memilih ulang lewat
            pemeriksaan di bawah. */}
        {value(field) && options && !options.includes(value(field)) && (
          <option value={value(field)}>{value(field)}</option>
        )}
        {(options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );

  /**
   * Uang Pertanggungan dan Premi Dasar. Bila produknya punya rumus dua arah,
   * labelnya didahului radio pemilih dasar hitung dan isian satunya dikunci.
   */
  const uang = (field: "uang_pertanggungan" | "premi_dasar", label: string) => {
    // Mode "keduanya" mematikan hitung otomatis, jadi tidak ada yang dikunci.
    const terkunci = duaArah && dasar !== field && dasar !== "keduanya";

    function ketik(nilai: string) {
      const turunan = hitungPasangan({ [field]: nilai });
      setValues((prev) => ({ ...prev, [field]: nilai, ...turunan }));
      setErrors((prev) => ({ ...prev, uang_pertanggungan: "", premi_dasar: "" }));
    }

    return (
      <div className="flex flex-col gap-2.5">
        <label className="flex items-center gap-2.5 text-sm text-pfi-heading">
          {duaArah && (
            <input
              type="radio"
              name="dasar_hitung"
              value={field}
              checked={dasar === field}
              onChange={() => pilihDasar(field)}
              aria-label={`Hitung dari ${label}`}
              className="size-4 shrink-0 accent-pfi-link"
            />
          )}
          <span>
            {label}
            <span className="text-pfi-down-fg">*</span>
          </span>
        </label>

        <input
          inputMode="numeric"
          value={formatRibuan(value(field))}
          disabled={terkunci}
          aria-label={label}
          onChange={(event) => ketik(digitsOf(event.target.value))}
          onBlur={() => void simpan({ [field]: value(field), ...hitungPasangan() })}
          className={cn(
            inputClass,
            terkunci && "cursor-not-allowed bg-pfi-hairline text-pfi-subtle",
            errors[field] && "border-pfi-down-fg"
          )}
        />

        {errors[field] && (
          <p className="text-xs font-medium text-pfi-down-fg">{errors[field]}</p>
        )}
        {terkunci && keteranganDuaArah && (
          <p className="text-xs text-pfi-muted">{keteranganDuaArah}</p>
        )}
      </div>
    );
  };

  /** Pasangan "Pada Tahun ke-" dan "Jumlah", dipakai ketiga daftar. */
  const pasangan = (
    tahun: string,
    jumlah: string,
    onTahun: (nilai: string) => void,
    onJumlah: (nilai: string) => void,
    errTahun?: string,
    errJumlah?: string
  ) => (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Pada Tahun ke-" required error={errTahun}>
        <select
          value={tahun}
          onChange={(event) => onTahun(event.target.value)}
          className={cn(selectClass, errTahun && "border-pfi-down-fg")}
        >
          <option value="">Pilih tahun</option>
          {TAHUN_KE.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Jumlah" required error={errJumlah}>
        <input
          inputMode="numeric"
          value={formatRibuan(jumlah)}
          onChange={(event) => onJumlah(digitsOf(event.target.value))}
          className={cn(inputClass, errJumlah && "border-pfi-down-fg")}
        />
      </Field>
    </div>
  );

  const daftar = (
    judul: string,
    field: string,
    list: Entry[],
    setList: (next: Entry[]) => void,
    labelBaris: string,
    labelTambah: string
  ) => (
    <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
      <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
        <h2 className="text-lg font-bold text-pfi-heading">{judul}</h2>
      </header>

      <div className="flex flex-col gap-5 p-4 sm:p-6">
        {list.map((entry, index) => (
          <div
            key={`${field}-${index}`}
            className="flex flex-col gap-4 rounded-[10px] border border-pfi-hairline p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-3 border-b border-pfi-hairline pb-3">
              <div className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-full bg-pfi-tint text-sm font-medium text-pfi-link">
                  {index + 1}
                </span>
                <p className="text-base text-pfi-heading">
                  {labelBaris} ke-{index + 1}
                </p>
              </div>

              <button
                type="button"
                onClick={() => hapusEntry(list, setList, field, index)}
                aria-label={`Hapus ${labelBaris} ke-${index + 1}`}
                className="grid size-9 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline hover:text-pfi-down-fg"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </div>

            {pasangan(
              entry.tahun,
              entry.jumlah,
              (nilai) => ubahEntry(list, setList, field, index, "tahun", nilai),
              (nilai) => ubahEntry(list, setList, field, index, "jumlah", nilai),
              errors[`${field}_${index}_tahun`],
              errors[`${field}_${index}_jumlah`]
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => tambahEntry(list, setList, field)}
          className="mx-auto flex items-center gap-2.5 rounded-[10px] border border-pfi-link bg-white px-5 py-3 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
        >
          <Plus className="size-5" aria-hidden />
          {labelTambah}
        </button>
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={`${detailHref}/sales-illustration/policy-holder`} title="Ilustrasi" />
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
          {errors.usia && (
            <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
              {errors.usia}
            </p>
          )}

          <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
            <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
              <h2 className="text-lg font-bold text-pfi-heading">Detail Produk</h2>
            </header>

            <div className="flex flex-col gap-5 p-4 sm:p-6">
              <Field label="Jenis Produk" required error={errors.jenis_produk}>
                <div className="grid gap-5 sm:grid-cols-2">
                  {JENIS_PRODUK.map((option) => {
                    const dipilih = jenis === option;

                    return (
                      <label
                        key={option}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3.5 transition",
                          dipilih
                            ? "border-pfi-link bg-pfi-tint-alt"
                            : "border-pfi-line bg-white hover:bg-pfi-hairline"
                        )}
                      >
                        <input
                          type="radio"
                          name="jenis_produk"
                          value={option}
                          checked={dipilih}
                          onChange={() => pilihJenis(option)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full border-2",
                            dipilih ? "border-pfi-link" : "border-pfi-line"
                          )}
                        >
                          {dipilih && <span className="size-2.5 rounded-full bg-pfi-link" />}
                        </span>
                        <span
                          className={cn(
                            "text-base font-bold",
                            dipilih ? "text-pfi-link" : "text-pfi-heading"
                          )}
                        >
                          {option}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>

              <div className="border-t border-dashed border-pfi-line pt-5">
                <Field label="Nama Produk" required error={errors.nama_produk}>
                  <select
                    value={value("produk_id")}
                    onChange={(event) => void pilihProduk(event.target.value)}
                    disabled={products === null}
                    className={cn(selectClass, errors.nama_produk && "border-pfi-down-fg")}
                  >
                    <option value="">
                      {products === null ? "Master produk belum ditarik" : "Pilih produk"}
                    </option>
                    {produkPilihan.map((product) => (
                      <option key={product.id} value={product.id}>
                        {namaProduk(product)}
                      </option>
                    ))}
                  </select>
                  {products === null && (
                    <p className="text-xs text-pfi-muted">
                      Tarik master data dari halaman Profil agar daftar produk tersedia.
                    </p>
                  )}
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {dropdown("mata_uang", "Mata Uang", "Pilih mata uang", pilihanSetup.mataUang)}
                {dropdown("cara_bayar", "Cara Bayar", "Pilih cara bayar", pilihanSetup.caraBayar)}
                {dropdown(
                  "masa_pembayaran",
                  "Masa Pembayaran",
                  "Pilih masa pembayaran",
                  pilihanSetup.masaPembayaran
                )}
                {dropdown(
                  "masa_pertanggungan",
                  "Masa Pertanggungan",
                  "Pilih masa pertanggungan",
                  pilihanSetup.masaPertanggungan
                )}
                {duaArah && (
                  <label className="flex items-center gap-2.5 text-sm text-pfi-heading sm:col-span-2">
                    <input
                      type="radio"
                      name="dasar_hitung"
                      value="keduanya"
                      checked={dasar === "keduanya"}
                      onChange={() => pilihDasar("keduanya")}
                      className="size-4 shrink-0 accent-pfi-link"
                    />
                    <span>
                      Isi keduanya{" "}
                      <span className="text-pfi-muted">(tanpa hitung otomatis)</span>
                    </span>
                  </label>
                )}
                {uang("uang_pertanggungan", "Uang Pertanggungan")}
                {uang("premi_dasar", "Premi Dasar")}
              </div>
            </div>
          </section>

          {unitLink && (
            <>
              {daftar(
                "Top Up Berkala",
                "top_up_berkala",
                berkala,
                setBerkala,
                "Top Up Berkala",
                "Tambah Top Up Berkala"
              )}

              <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
                <header className="border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
                  <h2 className="text-lg font-bold text-pfi-heading">Top Up Tunggal</h2>
                </header>

                <div className="p-4 sm:p-6">
                  {pasangan(
                    value("top_up_tunggal_tahun"),
                    value("top_up_tunggal_jumlah"),
                    (nilai) => pilih("top_up_tunggal_tahun", nilai),
                    (nilai) => {
                      ubah("top_up_tunggal_jumlah", nilai);
                      void simpan({ top_up_tunggal_jumlah: nilai });
                    },
                    errors.top_up_tunggal_tahun,
                    errors.top_up_tunggal_jumlah
                  )}
                </div>
              </section>

              {daftar(
                "Penarikan",
                "penarikan",
                penarikan,
                setPenarikan,
                "Penarikan",
                "Tambah Penarikan"
              )}
            </>
          )}
        </>
      )}

      <FnaFooter
        backHref={`${detailHref}/sales-illustration/policy-holder`}
        onNext={() => void goNext()}
      />
    </div>
  );
}
