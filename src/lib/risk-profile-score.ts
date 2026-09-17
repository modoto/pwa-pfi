/**
 * Perhitungan skor Kuesioner Profil Risiko.
 *
 * Bobot tiap jawaban dan rentang tiap profil datang dari master lokal, bukan
 * dari kode: pertanyaan + bobot dari `rpq_config_questions` / `rpq_config_answers`
 * (endpoint `GetDataRpqByRpqCode` dan `GetAllRpqConfigAnswer`), rentang profil
 * dan pilihan dananya dari `mappings` + `fund_mapping_funds`.
 *
 * Skor = penjumlahan bobot jawaban yang dipilih. Pertanyaan yang belum dijawab
 * bernilai nol, jadi skornya ikut bertambah seiring kuesioner diisi.
 */

import type { MasterRiskProfile, MasterRpqQuestion } from "@/lib/db/master-repo";
import type { FnaQuestion } from "@/lib/fna-questions";

/** Bentuk yang dipakai `FnaQuestionList`; kuncinya kode pertanyaan RPQ. */
export const toFnaQuestions = (rows: MasterRpqQuestion[]): FnaQuestion[] =>
  rows.map((row) => ({
    key: row.key,
    text: row.text,
    options: row.answers.map((item) => item.text),
  }));

export type RiskProfileResult = {
  /** Total bobot jawaban; `null` bila belum ada satu pun jawaban. */
  skor: number | null;
  /** Skor tertinggi yang mungkin — dipakai untuk menerangkan hasilnya. */
  skorMaksimal: number;
  terjawab: number;
  total: number;
};

export type RiskProfileView = RiskProfileResult & {
  /** Profil dari `mappings`; null bila skor belum ada atau master belum ditarik. */
  profil: MasterRiskProfile | null;
};

/** Skor sekaligus profil investasinya — satu panggilan untuk layar hasil. */
export function riskProfileView(
  answers: Record<string, string>,
  questions: MasterRpqQuestion[],
  profiles: MasterRiskProfile[]
): RiskProfileView {
  const hasil = scoreRiskProfile(answers, questions);
  return { ...hasil, profil: profileForScore(hasil.skor, profiles) };
}

export function scoreRiskProfile(
  answers: Record<string, string>,
  questions: MasterRpqQuestion[]
): RiskProfileResult {
  let skor = 0;
  let terjawab = 0;
  let skorMaksimal = 0;

  for (const question of questions) {
    skorMaksimal += Math.max(0, ...question.answers.map((item) => item.bobot));

    const jawaban = answers[question.key];
    const pilihan = question.answers.find((item) => item.text === jawaban);
    if (!pilihan) continue;

    skor += pilihan.bobot;
    terjawab += 1;
  }

  return {
    skor: terjawab > 0 ? skor : null,
    skorMaksimal,
    terjawab,
    total: questions.length,
  };
}

/**
 * Profil investasi untuk satu skor. Rentang di master bersinggungan di
 * ujungnya (0–250, 250–350, …), jadi yang dipakai profil terakhir yang batas
 * bawahnya masih di bawah atau sama dengan skor — skor 250 berarti Moderate.
 */
export function profileForScore(
  skor: number | null,
  profiles: MasterRiskProfile[]
): MasterRiskProfile | null {
  if (skor === null) return null;

  const urut = [...profiles].sort((a, b) => a.skorDari - b.skorDari);
  let hasil: MasterRiskProfile | null = null;
  for (const profile of urut) if (skor >= profile.skorDari) hasil = profile;

  return hasil ?? urut[0] ?? null;
}
