/**
 * Nomor perangkat yang dikirim saat login.
 *
 * API **mengikat akun ke perangkat**: login dengan `deviceNumber` berbeda dari
 * login pertama ditolak "Device tidak sesuai" (lihat docs/catatan-api.md). Jadi
 * UUID-nya dibuat **sekali** lalu disimpan, bukan diacak tiap kali masuk —
 * kalau diacak, login kedua pasti gagal.
 *
 * Disimpannya di dua tempat karena keduanya bisa hilang sendiri-sendiri:
 * `localStorage` (ikut terhapus saat data situs dibersihkan) dan cookie berumur
 * panjang (ikut terhapus saat cookie dibersihkan). Selama salah satunya masih
 * ada, nomor perangkatnya tetap sama.
 *
 * Berkas ini sengaja tanpa `"use client"` supaya polanya bisa dipakai juga oleh
 * Server Action yang memvalidasi kiriman form; fungsi penyimpanannya hanya
 * dipanggil dari browser.
 */

const KUNCI = "pfi_device_number";
const COOKIE = "pfi_device_number";

/** 10 tahun — nomor perangkat tidak punya masa berlaku. */
const UMUR_COOKIE = 60 * 60 * 24 * 365 * 10;

export const POLA_NOMOR_PERANGKAT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nama field pada form login. */
export const FIELD_NOMOR_PERANGKAT = "device_number";

/**
 * UUID v4. `crypto.randomUUID` hanya ada di secure context, sedangkan aplikasi
 * kadang dibuka lewat IP di jaringan lokal saat uji coba.
 */
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const acak = crypto.getRandomValues(new Uint8Array(16));
  acak[6] = (acak[6] & 0x0f) | 0x40;
  acak[8] = (acak[8] & 0x3f) | 0x80;

  const hex = [...acak].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function dariPenyimpanan(): string | null {
  try {
    return localStorage.getItem(KUNCI);
  } catch {
    // Mode penyamaran / penyimpanan diblokir.
    return null;
  }
}

function dariCookie(): string | null {
  const cocok = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return cocok ? decodeURIComponent(cocok[1]) : null;
}

function simpan(nomor: string) {
  try {
    localStorage.setItem(KUNCI, nomor);
  } catch {
    // Biarkan; cookie di bawah masih menyimpannya.
  }

  const aman = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE}=${nomor}; max-age=${UMUR_COOKIE}; path=/; samesite=lax${aman}`;
}

/**
 * Nomor perangkat ini — dibuat saat pertama dipanggil, sesudah itu dipakai ulang.
 * Hanya boleh dipanggil dari browser.
 */
export function nomorPerangkat(): string {
  const tersimpan = dariPenyimpanan() ?? dariCookie();

  if (tersimpan && POLA_NOMOR_PERANGKAT.test(tersimpan)) {
    // Tulis ulang supaya penyimpanan yang tadi kosong ikut terisi lagi.
    simpan(tersimpan);
    return tersimpan;
  }

  const baru = uuid();
  simpan(baru);

  return baru;
}
