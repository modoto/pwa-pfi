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

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
