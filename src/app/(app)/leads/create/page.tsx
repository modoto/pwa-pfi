import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/lead-form";

export const metadata: Metadata = {
  title: "Tambah Lead",
  description: "Formulir pendaftaran lead baru.",
};

export default function TambahLeadPage() {
  return <LeadForm />;
}
