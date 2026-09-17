import type { Metadata } from "next";
import { FnaPriorities } from "@/components/leads/fna-priorities";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "FnA — Prioritas Keuangan",
};

export default async function FnaPrioritiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  return <FnaPriorities leadId={id} agentName={session?.fullName ?? null} />;
}
