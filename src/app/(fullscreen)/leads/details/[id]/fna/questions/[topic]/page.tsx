import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FnaQuestions } from "@/components/leads/fna-questions";
import { topicByKey } from "@/lib/fna-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "FnA — Kuesioner",
};

export default async function FnaQuestionsPage({
  params,
}: {
  params: Promise<{ id: string; topic: string }>;
}) {
  const { id, topic } = await params;
  if (!topicByKey(topic)) notFound();

  const session = await getSession();

  return (
    <FnaQuestions leadId={id} topicKey={topic} agentName={session?.fullName ?? null} />
  );
}
