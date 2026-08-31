/**
 * Data contoh untuk Beranda.
 *
 * Bentuk tipenya sengaja dibuat seperti respons API yang diharapkan, sehingga
 * saat endpoint dashboard siap cukup ganti `getDashboardData()` menjadi
 * pemanggilan `apiGet(...)` tanpa mengubah komponen.
 */

export type Delta = {
  /** Persentase perubahan, mis. -12.5 */
  value: number;
  label: string;
};

export type PerformanceMetric = {
  key: string;
  label: string;
  value: string;
  delta: Delta;
};

export type PerformanceBlock = {
  title: string;
  metrics: PerformanceMetric[];
};

export type CountCard = {
  key: string;
  label: string;
  caption: string;
  value: number;
  icon: string;
  /** Latar bulatan ikon; mengikuti dua nuansa yang dipakai desain. */
  tint: "blue" | "blue-alt";
};

export type VisitBucket = { key: string; label: string; value: number };

export type ActivityCategory = "leads" | "training";

export type ScheduleItem = {
  id: string;
  category: ActivityCategory;
  title: string;
  badge: string;
  note: string;
  place: string;
  time: string;
  tag: string;
};

export type ScheduleTab = { key: string; label: string; count: number };

export type CalendarDay = {
  day: number;
  categories: ActivityCategory[];
};

export type NewsItem = {
  id: string;
  title: string;
  date: string;
  image: string;
};

export type DashboardData = {
  performance: PerformanceBlock[];
  activities: CountCard[];
  visits: VisitBucket[];
  schedule: {
    month: string;
    year: number;
    /** 0 = Minggu, sesuai urutan kolom kalender pada desain. */
    firstWeekday: number;
    daysInMonth: number;
    selectedDay: number;
    marks: CalendarDay[];
    tabs: ScheduleTab[];
    activeTab: string;
    dateLabel: string;
    items: ScheduleItem[];
  };
  leads: CountCard[];
  news: NewsItem[];
};

const performanceMetrics: PerformanceMetric[] = [
  { key: "ape", label: "APE", value: "530.000.000", delta: { value: -12.5, label: "vs last month" } },
  { key: "seller", label: "SELLER ACTIVE", value: "40", delta: { value: 2.5, label: "vs last month" } },
  { key: "cc", label: "CC", value: "27", delta: { value: 2.5, label: "vs last month" } },
  { key: "branch", label: "BRANCH ACTIVE", value: "18", delta: { value: 2.5, label: "vs last month" } },
];

export function getDashboardData(): DashboardData {
  return {
    performance: [
      { title: "Performa MTD", metrics: performanceMetrics },
      { title: "Performa YTD", metrics: performanceMetrics },
    ],

    activities: [
      {
        key: "spaj",
        label: "SPAJ Pending",
        caption: "Action Required",
        value: 5,
        icon: "/dashboard/act-spaj.svg",
        tint: "blue",
      },
      {
        key: "issued",
        label: "Total Issued",
        caption: "Action Required",
        value: 7,
        icon: "/dashboard/act-issued.svg",
        tint: "blue-alt",
      },
      {
        key: "inactive",
        label: "Polis Tidak Aktif",
        caption: "Follow-Up Needed",
        value: 12,
        icon: "/dashboard/act-inactive.svg",
        tint: "blue-alt",
      },
    ],

    visits: [
      { key: "v1", label: "Visit 1", value: 200 },
      { key: "v2", label: "Visit 2", value: 200 },
      { key: "v3", label: "Visit 3", value: 200 },
      { key: "v4", label: "Visit Lebih Dari 3", value: 200 },
    ],

    schedule: {
      month: "Juni",
      year: 2026,
      // 1 Juni 2026 jatuh pada hari Senin.
      firstWeekday: 1,
      daysInMonth: 30,
      selectedDay: 22,
      marks: [
        { day: 9, categories: ["leads", "training"] },
        { day: 12, categories: ["leads", "training"] },
        { day: 22, categories: ["leads", "training"] },
        { day: 24, categories: ["leads", "training"] },
        { day: 27, categories: ["training"] },
      ],
      tabs: [
        { key: "hari-ini", label: "Hari Ini", count: 3 },
        { key: "minggu-ini", label: "Minggu Ini", count: 6 },
        { key: "bulan-ini", label: "Bulan Ini", count: 12 },
        { key: "akan-datang", label: "Akan Datang", count: 3 },
      ],
      activeTab: "hari-ini",
      dateLabel: "Senin, 22 Juni 2026",
      items: [
        {
          id: "a1",
          category: "leads",
          title: "Rina Marlina",
          badge: "Visit Offline",
          note: "Janji temu visit pertama setelah event",
          place: "Grand Indonesia",
          time: "-",
          tag: "Visit 1",
        },
        {
          id: "a2",
          category: "leads",
          title: "Rina Marlina",
          badge: "Visit Offline",
          note: "Janji temu visit pertama setelah event",
          place: "Grand Indonesia",
          time: "-",
          tag: "Visit 1",
        },
        {
          id: "a3",
          category: "training",
          title: "Digital Tools Onboarding",
          badge: "Training Online",
          note: "Janji temu visit pertama setelah event",
          place: "Zoom",
          time: "12:00 - 14:00",
          tag: "Visit 1",
        },
      ],
    },

    leads: [
      {
        key: "total",
        label: "Total Leads",
        caption: "Follow-Up Needed",
        value: 65,
        icon: "/dashboard/lead-total.svg",
        tint: "blue",
      },
      {
        key: "progress",
        label: "Leads On Progress",
        caption: "Follow-Up Needed",
        value: 34,
        icon: "/dashboard/lead-progress.svg",
        tint: "blue",
      },
      {
        key: "no-activity",
        label: "Leads No Activity",
        caption: "No Recent Activity",
        value: 10,
        icon: "/dashboard/lead-noactivity.svg",
        tint: "blue",
      },
      {
        key: "due-date",
        label: "Due Date Policy",
        caption: "This Month",
        value: 12,
        icon: "/dashboard/lead-duedate.svg",
        tint: "blue",
      },
      {
        key: "birthday",
        label: "Customer Birthday",
        caption: "This Month",
        value: 18,
        icon: "/dashboard/lead-birthday.svg",
        tint: "blue",
      },
    ],

    news: [
      {
        id: "n1",
        title: "Pengumuman Rencana Kerja Pemisahan Unit Usaha Syariah PT PFI Mega Life Insurance",
        date: "20 Februari 2026",
        image: "/dashboard/berita/berita-1.jpg",
      },
      {
        id: "n2",
        title: "Proteksi Diri sekaligus Berinvestasi sesuai Prinsip Syariah",
        date: "20 Februari 2026",
        image: "/dashboard/berita/berita-2.jpg",
      },
      {
        id: "n3",
        title: "Puasa Nahan Lapar, Sekalian Nahan Pengeluaran",
        date: "20 Februari 2026",
        image: "/dashboard/berita/berita-3.jpg",
      },
      {
        id: "n4",
        title: "PFI Mega Life Luncurkan Mega Proteksi Masa Depan (MAPAN) dari PFI Mega Life",
        date: "20 Februari 2026",
        image: "/dashboard/berita/berita-4.jpg",
      },
      {
        id: "n5",
        title: "5 Tanda Anda Butuh Asuransi Jiwa Sekarang",
        date: "20 Februari 2026",
        image: "/dashboard/berita/berita-5.jpg",
      },
    ],
  };
}
