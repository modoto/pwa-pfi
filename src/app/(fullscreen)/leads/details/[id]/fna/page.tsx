import type { Metadata } from "next";
import { FnaIntro } from "@/components/leads/fna-intro";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "FnA",
  description: "Analisis kebutuhan dan keuangan lead.",
};

export default async function FnaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  return <FnaIntro leadId={id} agentName={session?.fullName ?? null} />;
}
