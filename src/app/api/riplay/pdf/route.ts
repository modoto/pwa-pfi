import { getSession } from "@/lib/session";
import { KonversiPdfError, cariLibreOffice, konversiDocxKePdf } from "@/lib/docx-to-pdf";

/**
 * Konversi dokumen RIPLAY yang sudah diisi di perangkat menjadi PDF.
 *
 * Dokumennya dikirim mentah sebagai body (bukan multipart) karena isinya hanya
 * satu berkas. Kalau LibreOffice tidak ada atau konversinya gagal, jawabannya
 * 503 — klien kembali memakai pratinjau HTML, jadi langkah RIPLAY tetap jalan.
 */

// Butuh proses Node: konversinya menjalankan biner LibreOffice.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Template terbesar ±2 MB; batas ini hanya penjaga agar body tidak liar. */
const BATAS_UNGGAH = 32 * 1024 * 1024;

const gagal = (pesan: string, status: number) =>
  Response.json({ pesan }, { status });

/** Pemeriksaan ketersediaan supaya klien tidak mengirim dokumen sia-sia. */
export async function GET() {
  if (!(await getSession())) return gagal("Sesi berakhir, silakan masuk lagi.", 401);
  return Response.json({ tersedia: (await cariLibreOffice()) !== null });
}

export async function POST(request: Request) {
  if (!(await getSession())) return gagal("Sesi berakhir, silakan masuk lagi.", 401);

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) return gagal("Dokumen kosong.", 400);
  if (body.byteLength > BATAS_UNGGAH) return gagal("Dokumen terlalu besar.", 413);

  try {
    const pdf = await konversiDocxKePdf(Buffer.from(body));

    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-length": String(pdf.byteLength),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof KonversiPdfError) return gagal(error.message, 503);
    throw error;
  }
}
