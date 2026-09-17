/**
 * Daftar master data yang ditarik dari `/api/mobile/MasterData/*`.
 *
 * Nama tabel lokalnya mengikuti docs/konvensi-database.md: lowercase, jamak,
 * snake_case. Tiga tabel dinamai lain atas permintaan user (2026-09-02):
 * `cms`, `msstatus`, dan `msfields`. Kolomnya tidak ditulis di sini — bentuk
 * respons tiap endpoint tidak dijelaskan swagger (semuanya hanya "200 OK"),
 * jadi kolom dibuat dari data yang benar-benar datang; lihat
 * src/lib/db/master-repo.ts.
 *
 * Yang sengaja tidak ditarik:
 * - `GetAllLeads`, `GetAllLeadActivity`, `GetAllLeadEvents`, `GetAllLeadScore` —
 *   ini data lead (transaksional), bukan master; tempatnya di sinkronisasi lead,
 *   bukan di tarikan master data. Lihat docs/offline-first-sync.md.
 * - `GetAgentById` / `GetUserById` — data pegawai per id, bukan daftar master
 *   (permintaan user 2026-09-02, dulu `GetAllAgent` / `GetAllUser`).
 * - `GetAllPasswordResetOtp` — berisi email pengguna, hash OTP, dan hash token
 *   reset password. Data autentikasi seperti ini tidak boleh tersalin ke
 *   perangkat agen.
 *
 * Diperiksa langsung terhadap API pada 2026-09-16 (lihat docs/catatan-api.md).
 */

export type MasterSource = {
  /** Nama endpoint tanpa awalan /api/mobile/MasterData/. */
  endpoint: string;
  /** Nama tabel lokal. */
  table: string;
  /** Judul yang tampil di layar. */
  label: string;
};

export const MASTER_SOURCES: MasterSource[] = [
  { endpoint: "GetAllActivityNote", table: "activity_notes", label: "Catatan Aktivitas" },
  { endpoint: "GetAllAdditionalForm", table: "additional_forms", label: "Form Tambahan" },
  // Per 2026-09-11 isinya sama persis dengan GetAllActivityNote — bug server.
  { endpoint: "GetAllActivityType", table: "activity_types", label: "Jenis Aktivitas" },
  {
    endpoint: "GetAllAdditionalInsurance",
    table: "additional_insurances",
    label: "Asuransi Tambahan",
  },
  { endpoint: "GetAllAgentCoverage", table: "agent_coverages", label: "Cakupan Agen" },
  { endpoint: "GetAllAgentScore", table: "agent_scores", label: "Skor Agen" },
  { endpoint: "GetAllAml", table: "amls", label: "AML" },
  { endpoint: "GetAllArea", table: "areas", label: "Area" },
  { endpoint: "GetAllBank", table: "banks", label: "Bank" },
  { endpoint: "GetAllBankStaff", table: "bank_staffs", label: "Bank Staff" },
  { endpoint: "GetAllBlackList", table: "black_lists", label: "Daftar Hitam" },
  { endpoint: "GetAllBranch", table: "branches", label: "Cabang" },
  { endpoint: "GetAllCampaign", table: "campaigns", label: "Kampanye" },
  { endpoint: "GetAllCategory", table: "categories", label: "Kategori Produk" },
  { endpoint: "GetAllChannel", table: "channels", label: "Channel" },
  { endpoint: "GetAllCity", table: "cities", label: "Kota" },
  { endpoint: "GetAllCms", table: "cms", label: "CMS" },
  { endpoint: "GetAllDepartment", table: "departments", label: "Departemen" },
  { endpoint: "GetAllDisallowedRider", table: "disallowed_riders", label: "Rider Terlarang" },
  { endpoint: "GetAllDistrict", table: "districts", label: "Kecamatan" },
  { endpoint: "GetAllEvent", table: "events", label: "Event" },
  { endpoint: "GetAllField", table: "msfields", label: "Field" },
  // Sempat balas HTTP 500; per 2026-09-16 sudah hidup.
  { endpoint: "GetAllFormQuestion", table: "form_questions", label: "Pertanyaan Form" },
  {
    endpoint: "GetAllFormQuestionOption",
    table: "form_question_options",
    label: "Opsi Pertanyaan Form",
  },
  { endpoint: "GetAllFund", table: "funds", label: "Dana Investasi" },
  {
    endpoint: "GetAllFundMappingFund",
    table: "fund_mapping_funds",
    label: "Pemetaan Dana",
  },
  {
    endpoint: "GetAllGroupNotification",
    table: "group_notifications",
    label: "Grup Notifikasi",
  },
  {
    endpoint: "GetAllGroupNotificationMember",
    table: "group_notification_members",
    label: "Anggota Grup Notifikasi",
  },
  {
    endpoint: "GetAllIllustrationTemplate",
    table: "illustration_templates",
    label: "Template Ilustrasi",
  },
  { endpoint: "GetAllLob", table: "lobs", label: "Line of Business" },
  { endpoint: "GetAllLog", table: "logs", label: "Log" },
  { endpoint: "GetAllMapping", table: "mappings", label: "Mapping" },
  {
    endpoint: "GetAllMessageCategory",
    table: "message_categories",
    label: "Kategori Pesan",
  },
  {
    endpoint: "GetAllMessageTemplate",
    table: "message_templates",
    label: "Template Pesan",
  },
  {
    endpoint: "GetAllMessageVariable",
    table: "message_variables",
    label: "Variabel Pesan",
  },
  { endpoint: "GetAllNationality", table: "nationalities", label: "Kewarganegaraan" },
  { endpoint: "GetAllNotification", table: "notifications", label: "Notifikasi" },
  { endpoint: "GetAllProduct", table: "products", label: "Produk" },
  {
    endpoint: "GetAllProductConsent",
    table: "product_consents",
    label: "Persetujuan Produk",
  },
  { endpoint: "GetAllProductSetup", table: "product_setups", label: "Setup Produk" },
  { endpoint: "GetAllProvince", table: "provinces", label: "Provinsi" },
  { endpoint: "GetAllPsAdditional", table: "ps_additionals", label: "PS Tambahan" },
  { endpoint: "GetAllPsAddSurvival", table: "ps_add_survivals", label: "PS Survival" },
  { endpoint: "GetAllPsCois", table: "ps_cois", label: "PS COI" },
  { endpoint: "GetAllPsDocCheck", table: "ps_doc_checks", label: "PS Cek Dokumen" },
  {
    endpoint: "GetAllPsIndicatorGroups",
    table: "ps_indicator_groups",
    label: "PS Grup Indikator",
  },
  {
    endpoint: "GetAllPsLoyaltyBonus",
    table: "ps_loyalty_bonuses",
    label: "PS Loyalty Bonus",
  },
  { endpoint: "GetAllPsMaturity", table: "ps_maturities", label: "PS Maturity" },
  {
    endpoint: "GetAllPsMinimumIndicator",
    table: "ps_minimum_indicators",
    label: "PS Indikator Minimum",
  },
  { endpoint: "GetAllPsPremiRate", table: "ps_premi_rates", label: "PS Tarif Premi" },
  { endpoint: "GetAllPsRider", table: "ps_riders", label: "PS Rider" },
  { endpoint: "GetAllPsValue", table: "ps_values", label: "PS Nilai" },
  { endpoint: "GetAllQuestionnaire", table: "questionnaires", label: "Kuesioner" },
  {
    endpoint: "GetAllQuestionnaireDetailOption",
    table: "questionnaire_detail_options",
    label: "Opsi Kuesioner",
  },
  { endpoint: "GetAllRegion", table: "regions", label: "Region" },
  { endpoint: "GetAllRider", table: "riders", label: "Rider" },
  {
    endpoint: "GetAllRiderIndicatorGroup",
    table: "rider_indicator_groups",
    label: "Grup Indikator Rider",
  },
  {
    endpoint: "GetAllRiderOccupation",
    table: "rider_occupations",
    label: "Occupation Rider",
  },
  {
    endpoint: "GetAllRiderPremiumRate",
    table: "rider_premium_rates",
    label: "Tarif Premi Rider",
  },
  { endpoint: "GetAllRpqConfig", table: "rpq_configs", label: "Konfigurasi RPQ" },
  // Pertanyaan RPQ tidak punya endpoint GetAll sendiri; diambil dari
  // `GetDataRpqByRpqCode` per rpqCode lalu diratakan (lihat actions/master-data.ts).
  {
    endpoint: "GetDataRpqByRpqCode",
    table: "rpq_config_questions",
    label: "Pertanyaan RPQ",
  },
  {
    endpoint: "GetAllRpqConfigAnswer",
    table: "rpq_config_answers",
    label: "Jawaban RPQ",
  },
  { endpoint: "GetAllSpajTemplate", table: "spaj_templates", label: "Template SPAJ" },
  { endpoint: "GetAllStatus", table: "msstatus", label: "Status" },
  { endpoint: "GetAllSubDistrict", table: "sub_districts", label: "Kelurahan" },
  { endpoint: "GetAllTraining", table: "trainings", label: "Pelatihan" },
  { endpoint: "GetAllTrainingAgent", table: "training_agents", label: "Peserta Pelatihan" },

  // Status yang boleh dipilih agen di modal Ubah Status Lead.
  {
    endpoint: "GetDataStatusChangeMobile",
    table: "mobile_status_changes",
    label: "Status Ubah (Mobile)",
  },
];

export const masterByTable = (table: string) =>
  MASTER_SOURCES.find((source) => source.table === table) ?? null;
