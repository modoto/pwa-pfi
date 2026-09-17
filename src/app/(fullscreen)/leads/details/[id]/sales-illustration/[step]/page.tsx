import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationPolicyHolder } from "@/components/leads/illustration-policy-holder";
import { IllustrationProduct } from "@/components/leads/illustration-product";
import { IllustrationRider } from "@/components/leads/illustration-rider";
import { IllustrationInvestment } from "@/components/leads/illustration-investment";
import { IllustrationQuotation } from "@/components/leads/illustration-quotation";
import { IllustrationRiplay } from "@/components/leads/illustration-riplay";
import { IllustrationSignature } from "@/components/leads/illustration-signature";
import { IllustrationRiskProfile } from "@/components/leads/illustration-risk-profile";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { stepBySlug } from "@/lib/illustration-data";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Ilustrasi",
};

/**
 * Satu langkah alur Sales Illustration. Baru langkah pertama yang ada
 * desainnya; tujuh sisanya menampilkan stepper dengan pemberitahuan.
 */
export default async function IllustrationStepPage({
  params,
}: {
  params: Promise<{ id: string; step: string }>;
}) {
  const { id, step } = await params;
  const found = stepBySlug(step);
  if (!found) notFound();

  const session = await getSession();
  const detailHref = `/leads/details/${id}`;

  if (step === "policy-holder") {
    return <IllustrationPolicyHolder leadId={id} agentName={session?.fullName ?? null} />;
  }

  if (step === "product") {
    return <IllustrationProduct leadId={id} agentName={session?.fullName ?? null} />;
  }

  if (step === "rider") {
    return <IllustrationRider leadId={id} agentName={session?.fullName ?? null} />;
  }

  if (step === "risk-profile") {
    return <IllustrationRiskProfile leadId={id} agentName={session?.fullName ?? null} />;
  }

  if (step === "investment") {
    return <IllustrationInvestment leadId={id} agentName={session?.fullName ?? null} />;
  }

  if (step === "quotation") {
    return <IllustrationQuotation leadId={id} agentName={session?.fullName ?? null} />;
  }

  if (step === "riplay") {
    return (
      <IllustrationRiplay
        leadId={id}
        agentName={session?.fullName ?? null}
        agentCode={session?.agentCode ?? null}
      />
    );
  }

  if (step === "signature") {
    return <IllustrationSignature leadId={id} agentName={session?.fullName ?? null} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={`${detailHref}/sales-illustration/policy-holder`} title="Ilustrasi" />
      <IllustrationStepper current={step} leadId={id} />

      <section className="flex flex-col items-center gap-3 rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card">
        <p className="text-base font-bold text-pfi-heading">{found.label} segera hadir</p>
        <p className="text-sm text-pfi-muted">
          Langkah ini belum dibuat — desainnya belum tersedia.
        </p>
        <Link
          href={`${detailHref}/sales-illustration/policy-holder`}
          className="mt-2 text-sm font-bold text-pfi-link hover:underline"
        >
          Kembali ke langkah pertama
        </Link>
      </section>
    </div>
  );
}
