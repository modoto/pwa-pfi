/**
 * Isi halaman pembuka FnA ("Tahukah Anda?").
 *
 * Teksnya disalin apa adanya dari desain, termasuk ejaannya — ini materi
 * penjualan, bukan label antarmuka, jadi perubahan kata harus dari tim bisnis.
 * Ilustrasi desain belum diekspor, sementara memakai ikon lucide.
 */

import { GraduationCap, HandCoins, PiggyBank, Vault } from "lucide-react";

export type FnaTopic = {
  key: string;
  title: string;
  question: string;
  body: string;
  icon: typeof Vault;
};

/** Empat slot prioritas pada langkah kedua, dinamai seperti di desain. */
export const PRIORITY_LABELS = [
  "Prioritas Pertama",
  "Prioritas Kedua",
  "Prioritas Ketiga",
  "Prioritas Keempat",
] as const;

export const FNA_TOPICS: FnaTopic[] = [
  {
    key: "perlindungan-pendapatan",
    title: "Perlindungan Pendapatan",
    question:
      "Bagaimana cara Anda memastikan ketidakpastian dalam hidup apa bila terjadi resiko meninggal dunia terlalu dini atau kecelakaan terhadap tulang punggung keluarga?",
    body: "Kita tidak memungkiri bahwa setiap individu dan keluarga akan selalu dihadapkan pada risiko kehidupan yang tidak dapat diprediksi, yang sewaktu-waktu dapat memengaruhi kondisi finansial secara signifikan.",
    icon: Vault,
  },
  {
    key: "pendidikan-anak",
    title: "Pendidikan Anak",
    question:
      "Sebagai orang tua, tentu Anda menginginkan yang terbaik untuk masa depan anak Anda, terutama tentang Pendidikan, bukan?",
    body: "Biaya pendidikan mengalami kenaikan sekitar 10–15% setiap tahunnya. Merencanakan dana pendidikan anak sejak dini menjadi langkah penting untuk memastikan masa depan mereka tetap terjamin.",
    icon: GraduationCap,
  },
  {
    key: "dana-pensiun",
    title: "Dana Pensiun",
    question:
      "Pernakah Anda membayangkan harus terus bekerja sepanjang hidup untuk tetap bisa memenuhi kebutuhan keluarga?",
    body: "Saat yang terbaik untuk mempersiapkan dana pensiun adalah sekarang, yaitu selama Anda produktif bekerja, sehingga Anda dapat menikmati masa pensiun dengan lebih tenang dan mandiri secara finansial.",
    icon: PiggyBank,
  },
  {
    key: "rencana-warisan",
    title: "Rencana Warisan",
    question: "Hidup untuk masa depan.",
    body: "Merencanakan warisan untuk keluarga menjadi hal yang sangat penting dalam perencanaan keuangan. Hal ini dapat mengantisipasi adanya kesulitan yang akan dihadapi di masa yang akan datang.",
    icon: HandCoins,
  },
];

export const topicByKey = (key: string) => FNA_TOPICS.find((topic) => topic.key === key) ?? null;
