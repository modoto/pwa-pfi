import { redirect } from "next/navigation";

/** Alur ilustrasi selalu dimulai dari langkah pertama. */
export default async function SalesIllustrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/leads/details/${id}/sales-illustration/policy-holder`);
}
