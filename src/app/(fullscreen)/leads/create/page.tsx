import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/lead-form";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tambah Lead",
  description: "Formulir pendaftaran lead baru.",
};

export default async function TambahLeadPage() {
  // Kategori dan sumber lead berbeda antara channel HDA dan Banca.
  const session = await getSession();
  return <LeadForm channel={session?.channel ?? ""} />;
}
