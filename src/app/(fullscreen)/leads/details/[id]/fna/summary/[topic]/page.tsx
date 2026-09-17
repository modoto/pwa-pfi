import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FnaSummary } from "@/components/leads/fna-summary";
import { topicByKey } from "@/lib/fna-data";

export const metadata: Metadata = {
  title: "FnA — Ringkasan Jawaban",
};

export default async function FnaSummaryPage({
  params,
}: {
  params: Promise<{ id: string; topic: string }>;
}) {
  const { id, topic } = await params;
  if (!topicByKey(topic)) notFound();

  return <FnaSummary leadId={id} topicKey={topic} />;
}
