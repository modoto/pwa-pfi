"use client";

/**
 * Unduh RIPLAY Personal sebagai `.docx` yang sudah terisi.
 *
 * Isi dokumennya dibuat `buatDocxRiplay` — sama persis dengan yang dipakai
 * pratinjau dan konversi PDF.
 */

import type { RiplayFill } from "@/lib/riplay-fill";
import { buatDocxRiplay, namaBerkasRiplay, unduhBlob } from "@/lib/riplay-docx";
import type { TandaTanganRiplay } from "@/lib/riplay-signature";

export async function unduhRiplay(
  templateUrl: string,
  fill: RiplayFill,
  namaPemegangPolis: string,
  ttd: TandaTanganRiplay = {}
): Promise<void> {
  const blob = await buatDocxRiplay(templateUrl, fill, ttd);
  unduhBlob(blob, `${namaBerkasRiplay(namaPemegangPolis)}.docx`);
}
