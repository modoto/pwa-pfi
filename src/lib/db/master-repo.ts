"use client";

/**
 * Penyimpanan master data di database lokal.
 *
 * Bentuk respons tiap endpoint tidak dijelaskan swagger, jadi tabelnya dibuat
 * dari data yang benar-benar datang: nama field camelCase dari API diubah ke
 * snake_case (docs/konvensi-database.md), lalu dipakai sebagai nama kolom.
 * Bila field di API bertambah, berkurang, atau berganti nama, tabelnya dibuat
 * ulang pada penarikan berikutnya, jadi perubahan bentuk di API tidak membuat
 * penarikan gagal dan tidak meninggalkan kolom yatim.
 *
 * Master data tidak masuk `sync_operations`: arahnya satu jalur, server → lokal,
 * dan API belum punya parameter `since` sehingga tiap tarikan adalah muat ulang
 * penuh (tabel dikosongkan lalu diisi kembali dalam satu transaksi).
 */

import { batch, select } from "./client";
import type { SqlValue, Statement } from "./protocol";
import { ensureReady } from "./leads-repo";

/** Nama tabel dan kolom dibatasi pola ini supaya tidak mungkin menyisipkan SQL. */
const AMAN = /^[a-z][a-z0-9_]*$/;

/** camelCase / PascalCase → snake_case. */
export function toSnakeCase(nama: string): string {
  return nama
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

/** Nilai non-primitif disimpan sebagai JSON supaya tidak ada data yang hilang. */
function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** Kolom gabungan dari seluruh baris — baris pertama belum tentu terlengkap. */
function columnsOf(rows: Record<string, unknown>[]): string[] {
  const kolom = new Map<string, string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const nama = toSnakeCase(key);
      if (AMAN.test(nama) && !kolom.has(nama)) kolom.set(nama, key);
    }
  }

  return [...kolom.keys()];
}

async function existingColumns(table: string): Promise<string[]> {
  const rows = await select<{ name: string }>(`pragma table_info(${table})`);
  return rows.map((row) => row.name);
}

function createSql(table: string, kolom: string[]): string {
  return `create table ${table} (
            ${kolom.map((nama) => `${nama} text`).join(",\n            ")}
          )`;
}

/** Urutan kolom tidak penting, hanya himpunannya. */
function samaSusunan(sudahAda: string[], baru: string[]): boolean {
  if (sudahAda.length !== baru.length) return false;
  const himpunan = new Set(sudahAda);
  return baru.every((nama) => himpunan.has(nama));
}

export type MasterSaveResult = { rows: number; columns: number };

/**
 * Batas parameter per perintah INSERT. SQLite mengizinkan 32.766 sejak 3.32;
 * dipakai jauh di bawahnya supaya aman di build mana pun.
 */
const MAKS_PARAMETER = 10_000;

/**
 * Ganti seluruh isi satu tabel master dengan data terbaru dari API.
 *
 * Bila susunan kolom berbeda dari tabel yang ada — field baru, field
 * dihapus, atau field berganti nama di API — tabelnya dibuat ulang, bukan
 * sekadar ditambah kolom: isinya memang dimuat ulang penuh setiap penarikan,
 * dan kolom yatim dari nama field lama hanya akan membingungkan.
 *
 * Daftar kosong tetap dicatat (endpointnya hidup tapi tidak berisi) dan tidak
 * mengubah susunan tabel yang sudah ada.
 */
export async function saveMaster(
  table: string,
  rows: Record<string, unknown>[],
  checksum: string | null = null
): Promise<MasterSaveResult> {
  if (!AMAN.test(table)) throw new Error(`Nama tabel tidak sah: ${table}`);
  await ensureReady();

  const kolom = columnsOf(rows);
  const sudahAda = await existingColumns(table);

  // Tabel selalu punya `ditarik_at` supaya umur data tetap terlihat.
  const semua = [...kolom, "ditarik_at"];

  const statements: Statement[] = [];

  if (sudahAda.length === 0) {
    statements.push({ sql: createSql(table, semua) });
  } else if (rows.length > 0 && !samaSusunan(sudahAda, semua)) {
    statements.push({ sql: `drop table ${table}` }, { sql: createSql(table, semua) });
  } else {
    statements.push({ sql: `delete from ${table}` });
  }

  const timestamp = new Date().toISOString();

  // Beberapa baris per INSERT: tabel kelurahan berisi ±84 ribu baris, dan satu
  // perintah per baris membuat pesan ke worker sangat besar dan lambat.
  const perPerintah = Math.max(1, Math.floor(MAKS_PARAMETER / semua.length));
  const placeholder = `(${semua.map(() => "?").join(", ")})`;

  for (let awal = 0; awal < rows.length; awal += perPerintah) {
    const potongan = rows.slice(awal, awal + perPerintah);
    const bind: SqlValue[] = [];

    for (const row of potongan) {
      const nilai = new Map<string, SqlValue>();
      for (const [key, value] of Object.entries(row)) {
        const nama = toSnakeCase(key);
        if (AMAN.test(nama)) nilai.set(nama, toSqlValue(value));
      }

      for (const nama of semua) {
        bind.push(nama === "ditarik_at" ? timestamp : (nilai.get(nama) ?? null));
      }
    }

    statements.push({
      sql: `insert into ${table} (${semua.join(", ")})
            values ${potongan.map(() => placeholder).join(", ")}`,
      bind,
    });
  }

  statements.push({
    sql: `insert into master_syncs (nama_tabel, jumlah_baris, ditarik_at, pesan_error, checksum)
          values (?, ?, ?, null, ?)
          on conflict(nama_tabel) do update set
            jumlah_baris = excluded.jumlah_baris,
            ditarik_at   = excluded.ditarik_at,
            pesan_error  = null,
            checksum     = excluded.checksum`,
    bind: [table, rows.length, timestamp, checksum],
  });

  await batch(statements);

  return { rows: rows.length, columns: kolom.length };
}

/** Catat kegagalan supaya terlihat master mana yang perlu diulang. */
export async function recordMasterError(table: string, message: string): Promise<void> {
  await ensureReady();

  await batch([
    {
      sql: `insert into master_syncs (nama_tabel, jumlah_baris, ditarik_at, pesan_error)
            values (?, null, ?, ?)
            on conflict(nama_tabel) do update set
              ditarik_at  = excluded.ditarik_at,
              pesan_error = excluded.pesan_error`,
      bind: [table, new Date().toISOString(), message],
    },
  ]);
}

export type MasterSyncRow = {
  nama_tabel: string;
  jumlah_baris: number | null;
  ditarik_at: string | null;
  pesan_error: string | null;
  /** Checksum server saat terakhir ditarik; kosong untuk tarikan lama. */
  checksum: string | null;
};

export async function listMasterSyncs(): Promise<MasterSyncRow[]> {
  await ensureReady();
  return select<MasterSyncRow>(
    "select nama_tabel, jumlah_baris, ditarik_at, pesan_error, checksum from master_syncs"
  );
}

/*
 * ---------------------------------------------------------------------------
 * Pembaca master data untuk layar aplikasi.
 *
 * Sumbernya selalu tabel lokal hasil penarikan, tidak pernah API langsung —
 * aplikasi harus tetap jalan offline. `null` berarti tabelnya belum pernah
 * ditarik, supaya layar bisa mengarahkan agen ke halaman Profil alih-alih
 * menampilkan daftar kosong yang membingungkan.
 * ---------------------------------------------------------------------------
 */

async function tableExists(table: string): Promise<boolean> {
  const rows = await select<{ name: string }>(
    "select name from sqlite_master where type = 'table' and name = ?",
    [table]
  );
  return rows.length > 0;
}

/** Baris master yang aktif dan tidak terhapus, diurutkan menurut id server. */
async function activeRows<T>(
  table: string,
  columns: string[],
  /** Saringan kesamaan tambahan, mis. `{ product_id: "31" }`. */
  where: Record<string, string> = {}
): Promise<T[] | null> {
  const semuaNama = [...columns, ...Object.keys(where)];
  if (!AMAN.test(table) || !semuaNama.every((nama) => AMAN.test(nama))) {
    throw new Error(`Nama tabel/kolom tidak sah: ${table}`);
  }

  await ensureReady();
  if (!(await tableExists(table))) return null;

  // Kolom yang tidak dikirim API tidak pernah dibuat, jadi hanya kolom yang
  // benar-benar ada yang dipakai untuk menyaring.
  const ada = await existingColumns(table);
  const syarat = [
    ada.includes("status") ? "(status is null or lower(status) = 'active')" : null,
    ada.includes("deleted_at") ? "deleted_at is null" : null,
  ].filter(Boolean);

  const bind: SqlValue[] = [];
  for (const [kolom, nilai] of Object.entries(where)) {
    // Saringan pada kolom yang tidak ada berarti tidak ada baris yang cocok.
    if (!ada.includes(kolom)) return [];
    syarat.push(`${kolom} = ?`);
    bind.push(nilai);
  }

  const pilih = columns.map((nama) => (ada.includes(nama) ? nama : `null as ${nama}`));
  const urut = ada.includes("id") ? "order by cast(id as integer)" : "";

  return select<T>(
    `select ${pilih.join(", ")} from ${table}
     ${syarat.length > 0 ? `where ${syarat.join(" and ")}` : ""}
     ${urut}`,
    bind
  );
}

/**
 * Kolom berisi daftar (mis. `policy_term` = `[7,10]`) disimpan sebagai teks
 * JSON saat penarikan; fungsi ini membacanya kembali.
 */
export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

/** Satu produk dari tabel `products` (GetAllProduct). */
export type MasterProduct = {
  id: string;
  product_code: string | null;
  product_name: string | null;
  description: string | null;
  product_type: string | null;
  category_id: string | null;
  channel_id: string | null;
};

export function listProducts(): Promise<MasterProduct[] | null> {
  return activeRows<MasterProduct>("products", [
    "id",
    "product_code",
    "product_name",
    "description",
    "product_type",
    "category_id",
    "channel_id",
  ]);
}

/** Satu dana investasi dari tabel `funds` (GetAllFund). */
export type MasterFund = {
  id: string;
  fund_code: string | null;
  fund_name: string | null;
};

export function listFunds(): Promise<MasterFund[] | null> {
  return activeRows<MasterFund>("funds", ["id", "fund_code", "fund_name"]);
}

/**
 * Pilihan dropdown dari tabel `msfields` (GetAllField) untuk satu `field_key`,
 * mis. "marital_status" → Kawin, Belum Kawin, Cerai Hidup, Cerai Mati.
 */
export async function listFieldOptions(fieldKey: string): Promise<string[] | null> {
  const rows = await activeRows<{ field_text: string | null }>("msfields", ["id", "field_text"], {
    field_key: fieldKey,
  });
  if (rows === null) return null;
  return rows.map((row) => row.field_text ?? "").filter(Boolean);
}

/** Satu baris `msfields` (GetAllField). */
export type MasterField = {
  id: string;
  field_text: string | null;
  field_value: string | null;
  /** Induknya di `msfields`; sumber lead menunjuk ke kategori lead. */
  parent_id: string | null;
};

/**
 * Seluruh baris `msfields` untuk satu `field_key`, lengkap dengan id dan
 * induknya — dipakai daftar bertingkat seperti kategori → sumber lead.
 */
export function listFields(fieldKey: string): Promise<MasterField[] | null> {
  return activeRows<MasterField>("msfields", ["id", "field_text", "field_value", "parent_id"], {
    field_key: fieldKey,
  });
}

/**
 * Status yang boleh dipilih agen di modal Ubah Status Lead, dari tabel
 * `mobile_status_changes` (GetDataStatusChangeMobile).
 */
export async function listStatusChanges(): Promise<string[] | null> {
  const rows = await activeRows<{ status_name: string | null }>(
    "mobile_status_changes",
    ["id", "status_name"],
    { group_status: "lead_status" }
  );
  if (rows === null) return null;
  return rows.map((row) => row.status_name ?? "").filter(Boolean);
}

/** Satu pilihan jawaban RPQ beserta bobot skornya. */
export type MasterRpqAnswer = { text: string; bobot: number };

/** Satu pertanyaan Kuesioner Profil Risiko dari master RPQ. */
export type MasterRpqQuestion = {
  /** `rpqQuestionCode` (Q1, Q2, …) — dipakai sebagai kunci jawaban tersimpan. */
  key: string;
  text: string;
  answers: MasterRpqAnswer[];
};

/**
 * Kuesioner Profil Risiko dari master: pertanyaan (`rpq_config_questions`)
 * beserta jawaban dan bobotnya (`rpq_config_answers`). `null` bila salah satu
 * tabelnya belum pernah ditarik.
 */
export async function listRpqQuestions(): Promise<MasterRpqQuestion[] | null> {
  const [pertanyaan, jawaban] = await Promise.all([
    activeRows<{
      id: string;
      rpq_question_code: string | null;
      question_text: string | null;
      sort_order: string | null;
    }>("rpq_config_questions", ["id", "rpq_question_code", "question_text", "sort_order"]),
    activeRows<{
      rpq_config_question_id: string | null;
      answer_text: string | null;
      weight_of_value: string | null;
    }>("rpq_config_answers", [
      "id",
      "rpq_config_question_id",
      "answer_text",
      "weight_of_value",
    ]),
  ]);

  if (pertanyaan === null || jawaban === null) return null;

  return [...pertanyaan]
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    .map((row) => ({
      key: row.rpq_question_code ?? String(row.id),
      text: row.question_text ?? "",
      answers: jawaban
        .filter((item) => String(item.rpq_config_question_id) === String(row.id))
        .map((item) => ({ text: item.answer_text ?? "", bobot: Number(item.weight_of_value) || 0 })),
    }))
    .filter((row) => row.answers.length > 0);
}

/**
 * Satu profil investasi dari `mappings`: rentang skor RPQ, keterangan, dan
 * dana investasi yang boleh dipakai (`fund_mapping_funds` → `funds`).
 */
export type MasterRiskProfile = {
  id: string;
  product_id: string | null;
  nama: string;
  keterangan: string | null;
  skorDari: number;
  skorSampai: number;
  warna: string | null;
  funds: MasterFund[];
};

export async function listRiskProfiles(): Promise<MasterRiskProfile[] | null> {
  const [mappings, tautan, funds] = await Promise.all([
    activeRows<{
      id: string;
      product_id: string | null;
      customer_definition: string | null;
      definition_description: string | null;
      rpq_score_from: string | null;
      rpq_score_to: string | null;
      rpq_color: string | null;
    }>("mappings", [
      "id",
      "product_id",
      "customer_definition",
      "definition_description",
      "rpq_score_from",
      "rpq_score_to",
      "rpq_color",
    ]),
    activeRows<{ fund_mapping_id: string | null; fund_id: string | null }>(
      "fund_mapping_funds",
      ["id", "fund_mapping_id", "fund_id"]
    ),
    listFunds(),
  ]);

  if (mappings === null) return null;

  const perId = new Map((funds ?? []).map((fund) => [String(fund.id), fund]));

  return mappings
    .map((row) => ({
      id: String(row.id),
      product_id: row.product_id,
      nama: row.customer_definition ?? "",
      keterangan: row.definition_description,
      skorDari: Number(row.rpq_score_from) || 0,
      skorSampai: Number(row.rpq_score_to) || 0,
      warna: row.rpq_color,
      funds: (tautan ?? [])
        .filter((item) => String(item.fund_mapping_id) === String(row.id))
        .map((item) => perId.get(String(item.fund_id)))
        .filter((fund): fund is MasterFund => Boolean(fund)),
    }))
    .sort((a, b) => a.skorDari - b.skorDari);
}

/** Setup satu produk dari tabel `product_setups` (GetAllProductSetup). */
export type MasterProductSetup = {
  id: string;
  product_id: string;
  currency: string | null;
  /** Teks JSON, baca dengan `parseList`. */
  payment_mode: string | null;
  premium_term: string | null;
  policy_term: string | null;
  min_age_ph: string | null;
  max_age_ph: string | null;
  min_entry_age: string | null;
  max_entry_age: string | null;
  min_sum_assured: string | null;
  max_sum_assured: string | null;
  min_regular_topup: string | null;
  max_regular_topup: string | null;
  /** "1"/"0" — apakah UP boleh diketik agen atau selalu hasil hitungan. */
  is_sum_assured_editable: string | null;
  is_two_way_calculation: string | null;
};

export async function getProductSetup(productId: string): Promise<MasterProductSetup | null> {
  const rows = await activeRows<MasterProductSetup>(
    "product_setups",
    [
      "id",
      "product_id",
      "currency",
      "payment_mode",
      "premium_term",
      "policy_term",
      "min_age_ph",
      "max_age_ph",
      "min_entry_age",
      "max_entry_age",
      "min_sum_assured",
      "max_sum_assured",
      "min_regular_topup",
      "max_regular_topup",
      "is_sum_assured_editable",
      "is_two_way_calculation",
    ],
    { product_id: productId }
  );
  return rows?.[0] ?? null;
}

/** Premi minimum per cara bayar dari tabel `ps_minimum_indicators`. */
export type MasterMinimumIndicator = {
  payment_mode: string | null;
  premium_term: string | null;
  min_premium: string | null;
  max_premium: string | null;
};

export async function listMinimumIndicators(
  productSetupId: string
): Promise<MasterMinimumIndicator[]> {
  const rows = await activeRows<MasterMinimumIndicator>(
    "ps_minimum_indicators",
    ["id", "payment_mode", "premium_term", "min_premium", "max_premium"],
    { product_setup_id: productSetupId }
  );
  return rows ?? [];
}

/** Satu rider dari tabel `riders` (GetAllRider). */
export type MasterRider = {
  id: string;
  rider_code: string | null;
  rider_name: string | null;
  /** Singkatan rider, mis. "CIP", "HCPP", "WP" — dipakai memetakan ke mesin hitung. */
  description: string | null;
  /** Teks JSON, baca dengan `parseList`. */
  policy_term: string | null;
  min_sum_assured: string | null;
  max_sum_assured: string | null;
};

/**
 * Rider yang boleh diambil untuk satu setup produk: `ps_riders` menautkan
 * setup produk ke id rider, detailnya di `riders`. `null` bila salah satu
 * tabelnya belum ditarik.
 */
export async function listProductRiders(productSetupId: string): Promise<MasterRider[] | null> {
  const tautan = await activeRows<{ rider_id: string }>("ps_riders", ["id", "rider_id"], {
    product_setup_id: productSetupId,
  });
  const riders = await activeRows<MasterRider>("riders", [
    "id",
    "rider_code",
    "rider_name",
    "description",
    "policy_term",
    "min_sum_assured",
    "max_sum_assured",
  ]);

  if (tautan === null || riders === null) return null;

  const boleh = new Set(tautan.map((row) => String(row.rider_id)));
  return riders.filter((rider) => boleh.has(String(rider.id)));
}

/** Pasangan rider yang tidak boleh diambil bersamaan (`disallowed_riders`). */
export async function listDisallowedRiders(): Promise<[string, string][]> {
  const rows = await activeRows<{ rider_id: string; disallowed_rider_id: string }>(
    "disallowed_riders",
    ["id", "rider_id", "disallowed_rider_id"]
  );
  return (rows ?? []).map((row) => [String(row.rider_id), String(row.disallowed_rider_id)]);
}
