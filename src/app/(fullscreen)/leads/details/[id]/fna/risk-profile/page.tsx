import type { Metadata } from "next";
import { FnaRiskProfile } from "@/components/leads/fna-risk-profile";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "FnA — Kuesioner Profil Risiko",
};

export default async function FnaRiskProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  return <FnaRiskProfile leadId={id} agentName={session?.fullName ?? null} />;
}
