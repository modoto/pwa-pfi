/**
 * Skema database lokal.
 *
 * Konvensi (lihat docs/konvensi-database.md): nama tabel lowercase dan jamak,
 * nama kolom lowercase snake_case.
 *
 * Setiap tabel data membawa kolom sinkronisasi sejak awal, walau endpoint
 * servernya belum ada — menambahkannya belakangan berarti migrasi data.
 */

export type Migration = {
  version: number;
  name: string;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "leads_awal",
    statements: [
      `create table if not exists leads (
        id                text primary key,
        server_id         integer,
        lead_code         text,

        nama_depan        text not null,
        nama_tengah       text,
        nama_belakang     text,
        jenis_kelamin     text,
        tanggal_lahir     text,
        nomor_telepon     text,
        alamat_email      text,
        cif               text,
        kode_cabang       text,
        kategori          text,
        sumber            text,
        bank_staff_nip    text,
        bank_staff_nama   text,

        status            text not null default 'New',
        no_spaj           text,
        no_polis          text,
        tgl_inforce       text,

        skor_pekerjaan    real,
        skor_rumah        real,
        skor_sekolah      real,
        skor_anak         real,
        skor_kendaraan    real,
        skor_asuransi     real,
        skor_prediksi     real,
        skor_akhir        real,
        remark            text,

        sync_status       text not null default 'pending',
        created_at        text not null,
        updated_at        text not null,
        server_updated_at text,
        deleted_at        text
      )`,
      `create index if not exists idx_leads_deleted_at on leads (deleted_at)`,
      `create index if not exists idx_leads_sync_status on leads (sync_status)`,
      `create index if not exists idx_leads_nama_depan on leads (nama_depan)`,
      `create index if not exists idx_leads_status on leads (status)`,

      // Antrean operasi yang menunggu dikirim ke server.
      `create table if not exists sync_operations (
        id            text primary key,
        client_op_id  text not null unique,
        table_name    text not null,
        record_id     text not null,
        operation     text not null,
        payload       text not null,
        created_at    text not null,
        attempts      integer not null default 0,
        last_error    text
      )`,
      `create index if not exists idx_sync_operations_created_at on sync_operations (created_at)`,
    ],
  },
];

MIGRATIONS.push({
  version: 2,
  name: "detail_lead",
  statements: [
    `alter table leads add column tenaga_pemasar text`,
    `alter table leads add column rsm text`,
    `alter table leads add column keterangan text`,
    `alter table leads add column created_by text`,
    `alter table leads add column updated_by text`,

    // Riwayat perpindahan lead antar tenaga pemasar.
    `create table if not exists lead_assignments (
      id                        text primary key,
      server_id                 integer,
      lead_id                   text not null,
      tenaga_pemasar_sebelumnya text,
      tenaga_pemasar_sekarang   text,
      rsm                       text,
      tanggal                   text,
      remark                    text,
      sync_status               text not null default 'synced',
      created_at                text not null,
      updated_at                text not null,
      deleted_at                text
    )`,
    `create index if not exists idx_lead_assignments_lead_id on lead_assignments (lead_id)`,

    // Lengkapi baris contoh yang sudah terlanjur tersimpan dari migrasi 1.
    // Blok ini ikut dibuang bersama penyemaian saat API lead tersedia.
    `update leads
     set tenaga_pemasar = coalesce(tenaga_pemasar, 'Adi Wijaya'),
         rsm            = coalesce(rsm, 'Hendra Wijaya'),
         created_by     = coalesce(created_by, 'Adi Wijaya'),
         updated_by     = coalesce(updated_by, 'Adi Wijaya'),
         jenis_kelamin  = coalesce(jenis_kelamin, 'Laki-Laki'),
         tanggal_lahir  = coalesce(tanggal_lahir, '1990-10-02'),
         cif            = coalesce(cif, '4000' || substr(lead_code, -1)),
         kode_cabang    = coalesce(kode_cabang, 'KCP BLITAR'),
         bank_staff_nip = coalesce(bank_staff_nip, 'AG0001'),
         bank_staff_nama = coalesce(bank_staff_nama, 'Budi Santoso'),
         skor_pekerjaan = coalesce(skor_pekerjaan, 1.3),
         skor_rumah     = coalesce(skor_rumah, 1.3),
         skor_sekolah   = coalesce(skor_sekolah, 1.3),
         skor_anak      = coalesce(skor_anak, 1.3),
         skor_kendaraan = coalesce(skor_kendaraan, 1.3),
         skor_asuransi  = coalesce(skor_asuransi, 1.3),
         skor_prediksi  = coalesce(skor_prediksi, 2.3),
         skor_akhir     = coalesce(skor_akhir, 2.3),
         remark         = coalesce(remark, 'Antusias saat sesi event, minta dijadwalkan visit di rumah bersama istri.')
     where lead_code like 'LD%'`,

    `insert into lead_assignments
       (id, lead_id, tenaga_pemasar_sebelumnya, tenaga_pemasar_sekarang,
        rsm, tanggal, remark, created_at, updated_at)
     select lower(hex(randomblob(16))), l.id, null, 'Adi Wijaya', 'Hendra Wijaya',
            '01/06/2026', 'Assignment awal (peserta event Nutrition Talk)',
            l.created_at, l.updated_at
     from leads l
     where l.lead_code like 'LD%'
       and not exists (select 1 from lead_assignments a where a.lead_id = l.id)`,
  ],
});

MIGRATIONS.push({
  version: 3,
  name: "aktivitas_lead",
  statements: [
    `create table if not exists lead_activities (
      id                text primary key,
      server_id         integer,
      lead_id           text not null,

      jenis_aktivitas   text not null,
      keterangan        text,
      tanggal           text,
      waktu             text,
      lokasi_rencana    text,
      lokasi_aktual     text,
      catatan           text,
      catatan_tambahan  text,

      gambar            blob,
      gambar_tipe       text,
      gambar_nama       text,

      status            text not null default 'Terjadwal',
      created_by        text,
      updated_by        text,

      sync_status       text not null default 'pending',
      created_at        text not null,
      updated_at        text not null,
      server_updated_at text,
      deleted_at        text
    )`,
    `create index if not exists idx_lead_activities_lead_id on lead_activities (lead_id)`,
    `create index if not exists idx_lead_activities_status on lead_activities (status)`,
    `create index if not exists idx_lead_activities_tanggal on lead_activities (tanggal)`,

    // Aktivitas contoh untuk setiap lead bawaan, mengikuti tiga status di desain.
    // Ikut dibuang bersama penyemaian saat API aktivitas tersedia.
    `insert into lead_activities
       (id, lead_id, jenis_aktivitas, keterangan, tanggal, lokasi_rencana, catatan,
        status, created_by, updated_by, sync_status, created_at, updated_at)
     select lower(hex(randomblob(16))), l.id, 'Visit Offline',
            'Janji temu visit untuk membuat SPAJ', '2026-07-19', 'Grand Indonesia',
            'Visit 3', 'Terjadwal', 'Adi Wijaya', 'Adi Wijaya', 'synced',
            l.created_at, l.updated_at
     from leads l where l.lead_code like 'LD%'`,

    `insert into lead_activities
       (id, lead_id, jenis_aktivitas, keterangan, tanggal, lokasi_rencana, catatan,
        status, created_by, updated_by, sync_status, created_at, updated_at)
     select lower(hex(randomblob(16))), l.id, 'Visit Offline',
            'Janji temu visit membahas ilustrasi', '2026-07-14', 'Grand Indonesia',
            'Visit 2', 'Perlu Update', 'Adi Wijaya', 'Adi Wijaya', 'synced',
            l.created_at, l.updated_at
     from leads l where l.lead_code like 'LD%'`,

    `insert into lead_activities
       (id, lead_id, jenis_aktivitas, keterangan, tanggal, lokasi_rencana, lokasi_aktual,
        catatan, catatan_tambahan, status, created_by, updated_by, sync_status,
        created_at, updated_at)
     select lower(hex(randomblob(16))), l.id, 'Visit Offline',
            'Janji temu visit pertama', '2026-07-10', 'Grand Indonesia',
            'Grand Indonesia, Jakarta Pusat', 'Visit 1',
            'Nasabah tertarik, akan dijadwalkan pertemuan kembali didampingi istri.',
            'Selesai', 'Adi Wijaya', 'Adi Wijaya', 'synced', l.created_at, l.updated_at
     from leads l where l.lead_code like 'LD%'`,
  ],
});

MIGRATIONS.push({
  version: 4,
  name: "keterangan_status_lead",
  statements: [
    // Keterangan terakhir dari modal Ubah Status Lead. Terpisah dari kolom
    // `keterangan` milik lead itu sendiri, yang isinya bukan soal perubahan status.
    `alter table leads add column keterangan_status text`,
  ],
});

MIGRATIONS.push({
  version: 5,
  name: "proses_lead",
  statements: [
    // Tiga proses pada modal Mulai Proses. Satu baris per lead per proses;
    // halaman masing-masing proses belum ada, jadi untuk sekarang barisnya
    // hanya menyimpan status yang ditampilkan di modal.
    `create table if not exists lead_processes (
      id                text primary key,
      server_id         integer,
      lead_id           text not null,

      jenis             text not null,
      status            text not null,
      dimulai_at        text,
      selesai_at        text,

      created_by        text,
      updated_by        text,

      sync_status       text not null default 'pending',
      created_at        text not null,
      updated_at        text not null,
      server_updated_at text,
      deleted_at        text
    )`,
    `create unique index if not exists idx_lead_processes_lead_jenis
       on lead_processes (lead_id, jenis)`,

    // Baris awal untuk lead yang sudah ada. Lead yang dibuat setelah ini
    // dilengkapi `ensureProcesses` di processes-repo.ts.
    `insert into lead_processes (id, lead_id, jenis, status, sync_status, created_at, updated_at)
     select lower(hex(randomblob(16))), l.id, j.jenis, j.status, 'pending',
            l.created_at, l.updated_at
     from leads l
     join (select 'analisis' as jenis, 'Belum dimulai' as status
           union all select 'ilustrasi', 'Belum dimulai'
           union all select 'eapp', 'Belum dibuka') j
     where not exists (
       select 1 from lead_processes p where p.lead_id = l.id and p.jenis = j.jenis
     )`,
  ],
});

MIGRATIONS.push({
  version: 6,
  name: "prioritas_fna",
  statements: [
    // Empat slot prioritas keuangan pada langkah kedua FnA. Satu baris per
    // slot terisi; `topik` merujuk `key` di src/lib/fna-data.ts.
    `create table if not exists lead_fna_priorities (
      id                text primary key,
      server_id         integer,
      lead_id           text not null,

      urutan            integer not null,
      topik             text not null,

      created_by        text,
      updated_by        text,

      sync_status       text not null default 'pending',
      created_at        text not null,
      updated_at        text not null,
      server_updated_at text,
      deleted_at        text
    )`,
    `create unique index if not exists idx_lead_fna_priorities_lead_urutan
       on lead_fna_priorities (lead_id, urutan)`,
  ],
});

MIGRATIONS.push({
  version: 7,
  name: "jawaban_fna",
  statements: [
    // Jawaban kuesioner FnA. `topik` merujuk key di src/lib/fna-data.ts dan
    // `pertanyaan` merujuk key di src/lib/fna-questions.ts.
    `create table if not exists lead_fna_answers (
      id                text primary key,
      server_id         integer,
      lead_id           text not null,

      topik             text not null,
      pertanyaan        text not null,
      jawaban           text not null,

      created_by        text,
      updated_by        text,

      sync_status       text not null default 'pending',
      created_at        text not null,
      updated_at        text not null,
      server_updated_at text,
      deleted_at        text
    )`,
    `create unique index if not exists idx_lead_fna_answers_lead_topik_pertanyaan
       on lead_fna_answers (lead_id, topik, pertanyaan)`,
  ],
});

MIGRATIONS.push({
  version: 8,
  name: "isian_ilustrasi",
  statements: [
    // Isian formulir Sales Illustration, satu baris per field.
    //
    // Bentuk kunci-nilai dipilih karena alurnya delapan langkah dengan puluhan
    // field dan desainnya datang bertahap — langkah baru tidak perlu migrasi.
    // `langkah` = slug langkah (lihat src/lib/illustration-data.ts),
    // `field` = nama field dalam snake_case.
    `create table if not exists lead_illustration_fields (
      id                text primary key,
      server_id         integer,
      lead_id           text not null,

      langkah           text not null,
      field             text not null,
      nilai             text,

      created_by        text,
      updated_by        text,

      sync_status       text not null default 'pending',
      created_at        text not null,
      updated_at        text not null,
      server_updated_at text,
      deleted_at        text
    )`,
    `create unique index if not exists idx_lead_illustration_fields_unik
       on lead_illustration_fields (lead_id, langkah, field)`,
  ],
});

MIGRATIONS.push({
  version: 9,
  name: "catatan_master_data",
  statements: [
    // Riwayat penarikan master data. Tabel masternya sendiri tidak dibuat di
    // sini: kolomnya mengikuti bentuk respons API dan baru diketahui saat
    // ditarik (lihat src/lib/db/master-repo.ts).
    `create table if not exists master_syncs (
      nama_tabel   text primary key,
      jumlah_baris integer,
      ditarik_at   text,
      pesan_error  text
    )`,
  ],
});

MIGRATIONS.push({
  version: 10,
  name: "rename_tabel_master",
  statements: [
    // Tiga master berganti nama tabel (permintaan user 2026-09-02). Tabel lama
    // dibuang, bukan diganti nama: isinya dibuat ulang penuh pada penarikan
    // berikutnya, jadi tidak ada data yang benar-benar hilang.
    `drop table if exists cms_contents`,
    `drop table if exists statuses`,
    `drop table if exists fields`,
    `delete from master_syncs where nama_tabel in ('cms_contents', 'statuses', 'fields')`,
  ],
});

MIGRATIONS.push({
  version: 11,
  name: "master_data_api_2026_09_11",
  statements: [
    // Endpoint-nya tidak ada lagi di API per 2026-09-11, jadi tabel lokalnya
    // tidak akan pernah diperbarui. Dibuang supaya tidak terbaca sebagai data
    // yang masih berlaku.
    `drop table if exists audit_trails`,
    `drop table if exists roles`,
    `drop table if exists role_positions`,
    `delete from master_syncs where nama_tabel in ('audit_trails', 'roles', 'role_positions')`,
  ],
});

MIGRATIONS.push({
  version: 12,
  name: "master_data_api_2026_09_16",
  statements: [
    // Kategori dan sumber lead pindah ke `msfields` (fieldKey
    // lead_category_mobile_hda / lead_category_mobile_banca / lead_source_mobile
    // / lead_source); ketiga endpoint lamanya balas 404 per 2026-09-16.
    `drop table if exists hda_categories`,
    `drop table if exists banca_categories`,
    `drop table if exists lead_sources`,
    `delete from master_syncs where nama_tabel in ('hda_categories', 'banca_categories', 'lead_sources')`,
  ],
});

MIGRATIONS.push({
  version: 13,
  name: "master_syncs_checksum",
  statements: [
    // Checksum per tabel dari /api/mobile/SyncCheckSum/sync (2026-09-16), untuk
    // melewati master yang isinya tidak berubah saat menarik ulang.
    `alter table master_syncs add column checksum text`,
  ],
});

MIGRATIONS.push({
  version: 14,
  name: "app_settings",
  statements: [
    // Penanda kecil yang tidak ikut sinkron, mis. apakah data contoh lead
    // sudah pernah disemai (supaya tidak terisi ulang setelah dihapus).
    `create table if not exists app_settings (
      kunci text primary key,
      nilai text
    )`,
  ],
});

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
