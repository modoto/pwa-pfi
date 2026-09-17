"use client";

/**
 * PDF RIPLAY: dikonversi di server saat online, disimpan di perangkat.
 *
 * Pratinjau HTML (docx-preview) hanya mendekati tata letak Word, sedangkan
 * yang ditandatangani nasabah harus sama persis dengan dokumen yang diunduh.
 * Jadi dokumen terisi dikirim ke `/api/riplay/pdf` untuk dikonversi
 * LibreOffice, lalu hasilnya disimpan di OPFS supaya kunjungan berikutnya —
 * termasuk saat agen sedang offline di lapangan — tidak perlu server lagi.
 *
 * Kunci simpanannya sidik jari isi dokumen (SHA-256 berkas `.docx`), bukan
 * langkah ilustrasinya: begitu ada angka yang berubah, dokumennya berubah dan
 * PDF lama otomatis tidak terpakai.
 */

import type { RiplayFill } from "@/lib/riplay-fill";
import { buatDocxRiplay } from "@/lib/riplay-docx";
import type { TandaTanganRiplay } from "@/lib/riplay-signature";

const DIREKTORI = "riplay-pdf";

/** Kesalahan yang berarti "tampilkan pratinjau HTML saja", bukan kegagalan langkah. */
export class PdfTidakTersediaError extends Error {}

async function sidikJari(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/** Direktori simpanan PDF di OPFS; `null` kalau peramban tidak mengizinkan. */
async function direktori(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const akar = await navigator.storage?.getDirectory();
    return (await akar?.getDirectoryHandle(DIREKTORI, { create: true })) ?? null;
  } catch {
    return null;
  }
}

const namaBerkas = (leadId: string, templateId: string, hash: string) =>
  `${leadId}__${templateId}__${hash}.pdf`;

async function dariSimpanan(nama: string): Promise<Blob | null> {
  const dir = await direktori();
  if (!dir) return null;

  try {
    const berkas = await (await dir.getFileHandle(nama)).getFile();
    return berkas.size > 0 ? berkas : null;
  } catch {
    return null;
  }
}

/**
 * Simpan PDF dan buang versi lama milik lead + template yang sama — satu lead
 * bisa berkali-kali mengubah ilustrasi, dan kuota OPFS dipakai bersama SQLite.
 */
async function simpan(nama: string, awalan: string, pdf: Blob) {
  const dir = await direktori();
  if (!dir) return;

  try {
    const handle = await dir.getFileHandle(nama, { create: true });
    const tulis = await handle.createWritable();
    await tulis.write(pdf);
    await tulis.close();

    for await (const kunci of (
      dir as FileSystemDirectoryHandle & { keys(): AsyncIterableIterator<string> }
    ).keys()) {
      if (kunci !== nama && kunci.startsWith(awalan)) {
        await dir.removeEntry(kunci).catch(() => {});
      }
    }
  } catch {
    // Simpanan hanya mempercepat; kegagalannya tidak boleh menggagalkan tampilan.
  }
}

/** Kirim dokumen ke server untuk dikonversi. */
async function konversi(docx: Blob): Promise<Blob> {
  let jawaban: Response;

  try {
    jawaban = await fetch("/api/riplay/pdf", {
      method: "POST",
      headers: { "content-type": docx.type || "application/octet-stream" },
      body: docx,
    });
  } catch {
    throw new PdfTidakTersediaError(
      "Tidak bisa menghubungi server untuk membuat PDF. Pratinjau di bawah dibuat di perangkat."
    );
  }

  if (!jawaban.ok) {
    const pesan = await jawaban
      .json()
      .then((isi: { pesan?: string }) => isi.pesan)
      .catch(() => undefined);

    throw new PdfTidakTersediaError(pesan ?? `Konversi PDF gagal (${jawaban.status}).`);
  }

  return await jawaban.blob();
}

/**
 * PDF RIPLAY untuk satu lead + template.
 *
 * Urutannya: isi template di perangkat → cari di simpanan → kalau belum ada,
 * minta server mengonversi lalu simpan.
 */
export async function pdfRiplay({
  leadId,
  templateId,
  templateUrl,
  fill,
  ttd,
}: {
  leadId: string;
  templateId: string;
  templateUrl: string;
  fill: RiplayFill;
  ttd?: TandaTanganRiplay;
}): Promise<Blob> {
  const docx = await buatDocxRiplay(templateUrl, fill, ttd);
  const nama = namaBerkas(leadId, templateId, await sidikJari(docx));

  const tersimpan = await dariSimpanan(nama);
  if (tersimpan) return tersimpan;

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new PdfTidakTersediaError(
      "Perangkat sedang offline dan PDF dokumen ini belum pernah dibuat. Pratinjau di bawah dibuat di perangkat."
    );
  }

  const pdf = await konversi(docx);
  await simpan(nama, `${leadId}__${templateId}__`, pdf);

  return pdf;
}
