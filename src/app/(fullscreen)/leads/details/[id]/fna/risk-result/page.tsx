import type { Metadata } from "next";
import { FnaRiskResult } from "@/components/leads/fna-risk-result";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "FnA — Hasil Analisa Profil Risiko",
};

export default async function FnaRiskResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  return <FnaRiskResult leadId={id} agentName={session?.fullName ?? null} />;
}
