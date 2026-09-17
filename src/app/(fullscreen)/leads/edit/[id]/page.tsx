import type { Metadata } from "next";
import { LeadEditor } from "@/components/leads/lead-editor";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Edit Lead",
};

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  return <LeadEditor leadId={id} channel={session?.channel ?? ""} />;
}
