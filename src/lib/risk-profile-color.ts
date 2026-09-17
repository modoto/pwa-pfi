/**
 * Warna kartu hasil profil risiko.
 *
 * Warnanya datang dari master `mappings.rpq_color` (mis. Conservative
 * `#c7e4b3`, Moderate `#a8e9e4`, Growth `#fee595`, Aggresive `#f4b7be`).
 * Semuanya pastel muda, jadi warna teksnya tidak bisa selalu putih: di sini
 * kecerahan latar dihitung dulu (luminansi relatif WCAG), lalu dipilih teks
 * gelap atau terang supaya tetap terbaca.
 *
 * Bila profilnya belum ada — kuesioner belum dijawab atau master belum
 * ditarik — kartunya kembali ke oranye PFI seperti di desain.
 */

export type ProfileCardTone = {
  /** Dipasang sebagai `style` supaya warna dari master bisa apa saja. */
  style?: { backgroundColor: string };
  /** Kelas latar + warna teks utama. */
  card: string;
  /** Teks pendamping ("Skor Anda", "Profil Investasi"). */
  label: string;
  /** Garis pemisah antar-kolom. */
  divider: string;
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** #abc atau #aabbcc → [r, g, b]; format lain dianggap tidak dikenal. */
function rgb(warna: string): [number, number, number] | null {
  const cocok = HEX.exec(warna.trim());
  if (!cocok) return null;

  const hex =
    cocok[1].length === 3
      ? cocok[1]
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : cocok[1];

  return [0, 2, 4].map((mulai) => Number.parseInt(hex.slice(mulai, mulai + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Luminansi relatif WCAG; 0 = hitam, 1 = putih. */
function luminansi([r, g, b]: [number, number, number]): number {
  const kanal = [r, g, b].map((nilai) => {
    const bagian = nilai / 255;
    return bagian <= 0.03928 ? bagian / 12.92 : ((bagian + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * kanal[0] + 0.7152 * kanal[1] + 0.0722 * kanal[2];
}

const ORANYE: ProfileCardTone = {
  card: "bg-pfi-orange text-white",
  label: "text-white/90",
  divider: "bg-white/40",
};

export function profileCardTone(warna: string | null | undefined): ProfileCardTone {
  const nilai = warna?.trim();
  const warnaRgb = nilai ? rgb(nilai) : null;
  if (!nilai || !warnaRgb) return ORANYE;

  const latarTerang = luminansi(warnaRgb) > 0.45;
  const backgroundColor = nilai.startsWith("#") ? nilai : `#${nilai}`;

  return latarTerang
    ? {
        style: { backgroundColor },
        card: "text-pfi-heading",
        label: "text-pfi-heading/70",
        divider: "bg-pfi-heading/20",
      }
    : {
        style: { backgroundColor },
        card: "text-white",
        label: "text-white/90",
        divider: "bg-white/40",
      };
}
