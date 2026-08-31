import type { Metadata } from "next";
import { LeadEditor } from "@/components/leads/lead-editor";

export const metadata: Metadata = {
  title: "Edit Lead",
};

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadEditor leadId={id} />;
}
