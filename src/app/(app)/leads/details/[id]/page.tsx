import type { Metadata } from "next";
import { LeadDetail } from "@/components/leads/lead-detail";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Detail Lead",
};

export default async function DetailLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  // Nama agen dipakai untuk kolom "Dibuat Oleh" / "Diubah Oleh".
  return <LeadDetail leadId={id} agentName={session?.fullName ?? null} />;
}
