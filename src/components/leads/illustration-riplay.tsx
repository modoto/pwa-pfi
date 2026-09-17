"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FnaFooter, FnaHeader } from "@/components/leads/fna-chrome";
import { IllustrationStepper } from "@/components/leads/illustration-stepper";
import { RiplayDocument } from "@/components/leads/riplay-document";
import { projectUnitLink } from "@/lib/calc/unit-link";
import { buildMslInput } from "@/lib/calc/msl-input";
import { TEMPLATE_MSL, namaPemegangPolis, riplayValues } from "@/lib/riplay-values";
import { templateUrl, templatesForProduct, type RiplayTemplate } from "@/lib/riplay-templates";
import { unduhRiplay } from "@/lib/riplay-download";
import { namaBerkasRiplay, unduhBlob } from "@/lib/riplay-docx";
import { PdfTidakTersediaError, pdfRiplay } from "@/lib/riplay-pdf";
import { loadStep, saveStep } from "@/lib/db/illustration-repo";
import { listProducts } from "@/lib/db/master-repo";

const STEP = "riplay";

/** Produk terpilih dan template RIPLAY-nya, dibaca dari master lokal. */
type Produk = {
  /** Nama lengkap produk (`products.description`). */
  nama: string;
  templates: RiplayTemplate[];
};

/**
 * Langkah ketujuh Sales Illustration: RIPLAY Personal.
 *
 * Dokumennya template .docx dari tim bisnis sesuai produk yang dipilih
 * (lihat src/lib/riplay-templates.ts), dirender apa adanya di browser lalu
 * penandanya diisi data ilustrasi ini — termasuk tabel proyeksi yang dihitung
 * mesin di src/lib/calc untuk produk yang kalkulatornya sudah ada.
 */
export function IllustrationRiplay({
  leadId,
  agentName,
  agentCode,
}: {
  leadId: string;
  agentName: string | null;
  agentCode?: string | null;
}) {
  const router = useRouter();

  const [steps, setSteps] = useState<Record<string, Record<string, string>>>({});
  const [produk, setProduk] = useState<Produk | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [mengunduh, setMengunduh] = useState(false);
  const [pdf, setPdf] = useState<{ blob: Blob; url: string } | null>(null);
  const [pdfState, setPdfState] = useState<"menyiapkan" | "siap" | "tidak tersedia">("menyiapkan");
  const [pdfCatatan, setPdfCatatan] = useState("");

  const detailHref = `/leads/details/${leadId}`;
  const backHref = `${detailHref}/sales-illustration/quotation`;

  const load = useCallback(async () => {
    try {
      const [policyHolder, product, investment, rider, signature, saved, products] =
        await Promise.all([
          loadStep(leadId, "policy-holder"),
          loadStep(leadId, "product"),
          loadStep(leadId, "investment"),
          loadStep(leadId, "rider"),
          // Langkah Tanda Tangan datang setelah langkah ini, jadi biasanya masih
          // kosong; isinya baru ada saat agen kembali ke sini sesudah menandatangani.
          loadStep(leadId, "signature"),
          loadStep(leadId, STEP),
          listProducts(),
        ]);

      const master = products?.find((item) => item.id === product.produk_id) ?? null;
      const templates = templatesForProduct(master?.description);

      setSteps({ policyHolder, product, investment, rider, signature });
      setProduk(master ? { nama: master.description ?? "", templates } : null);
      // Pilihan template (mis. FUW / SIO untuk MAME) diingat per lead.
      setTemplateId(
        templates.find((item) => item.id === saved.template)?.id ?? templates[0]?.id ?? ""
      );
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  const template = produk?.templates.find((item) => item.id === templateId) ?? null;

  /**
   * Tanda tangan dari langkah terakhir, disisipkan ke dokumen sebagai gambar.
   * Objeknya dipakai sebagai dependency efek, jadi identitasnya harus stabil.
   */
  const ttd = useMemo(() => {
    const signature = steps.signature ?? {};

    return {
      pemegangPolis: signature.pp_tanda_tangan || undefined,
      tenagaPemasar: signature.tp_tanda_tangan || undefined,
    };
  }, [steps]);

  // Objeknya dipakai sebagai dependency efek render dokumen, jadi harus stabil.
  const values = useMemo(() => {
    if (state !== "ready" || !template) return null;

    const policyHolder = steps.policyHolder ?? {};
    const product = steps.product ?? {};
    const investment = steps.investment ?? {};
    const rider = steps.rider ?? {};

    // Kalkulator MSL.xlsm hanya berlaku untuk produk unit link-nya.
    const input = TEMPLATE_MSL.has(template.id)
      ? buildMslInput({ policyHolder, product, rider, investment })
      : null;

    return riplayValues(template.id, {
      policyHolder,
      product,
      investment,
      rider,
      agentName,
      agentCode,
      projection: input ? projectUnitLink(template.id === "maml" ? "maml" : "msl", input) : null,
    });
  }, [state, steps, agentName, agentCode, template]);

  /**
   * PDF-nya dibuat lebih dulu, bukan saat tombol ditekan: hasilnya yang
   * ditampilkan di layar. Konversi hanya berjalan sekali per isi dokumen —
   * `pdfRiplay` menyimpannya di perangkat dan memakai simpanan itu saat
   * ilustrasinya tidak berubah atau agen sedang offline.
   */
  useEffect(() => {
    if (!values || !template) return;

    let batal = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dokumennya ganti, statusnya harus kembali menunggu konversi
    setPdfState("menyiapkan");
    setPdfCatatan("");

    (async () => {
      try {
        const blob = await pdfRiplay({
          leadId,
          templateId: template.id,
          templateUrl: templateUrl(template),
          fill: values,
          ttd,
        });
        if (batal) return;

        setPdf({ blob, url: URL.createObjectURL(blob) });
        setPdfState("siap");
      } catch (error) {
        if (batal) return;

        setPdf(null);
        setPdfCatatan(
          error instanceof PdfTidakTersediaError
            ? error.message
            : "PDF tidak bisa dibuat; yang tampil di bawah pratinjau yang dibuat di perangkat."
        );
        setPdfState("tidak tersedia");
      }
    })();

    return () => {
      batal = true;
    };
  }, [leadId, template, ttd, values]);

  // Lepaskan URL lama saat dokumennya berganti atau layar ditinggalkan.
  useEffect(() => {
    if (!pdf) return;
    return () => URL.revokeObjectURL(pdf.url);
  }, [pdf]);

  async function pilihTemplate(id: string) {
    setTemplateId(id);
    try {
      await saveStep(leadId, STEP, { template: id }, agentName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.");
    }
  }

  /**
   * Simpan PDF hasil konversi LibreOffice.
   *
   * Kalau konversinya tidak tersedia (server tidak terjangkau atau LibreOffice
   * belum terpasang), jalan cadangannya dialog cetak peramban — agen tetap bisa
   * memilih "Save as PDF", hanya tata letaknya mengikuti pratinjau HTML.
   */
  function simpanPdf() {
    if (pdf) {
      unduhBlob(pdf.blob, `${namaBerkasRiplay(namaPemegangPolis(steps.policyHolder ?? {}))}.pdf`);
      return;
    }

    cetakPdf();
  }

  function cetakPdf() {
    document.body.classList.add("cetak-riplay");

    const selesai = () => {
      document.body.classList.remove("cetak-riplay");
      window.removeEventListener("afterprint", selesai);
    };

    window.addEventListener("afterprint", selesai);
    window.print();
  }

  async function unduh() {
    if (!values || !template) return;

    setMengunduh(true);
    try {
      await unduhRiplay(
        templateUrl(template),
        values,
        namaPemegangPolis(steps.policyHolder ?? {}),
        ttd
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengunduh dokumen RIPLAY.");
    } finally {
      setMengunduh(false);
    }
  }

  useEffect(() => {
    if (!layarPenuh) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLayarPenuh(false);
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [layarPenuh]);

  const kosong = (teks: string) => (
    <p className="py-10 text-center text-sm text-pfi-muted">{teks}</p>
  );

  /**
   * `penuh` membedakan kartu di halaman (tinggi tetap) dari mode layar penuh
   * (mengisi sisa tinggi layar).
   */
  function dokumen(penuh = false) {
    if (state === "loading") return kosong("Memuat data lokal …");
    if (!produk) {
      return kosong(
        "Pilih produk di langkah Rincian Produk dulu — dokumen RIPLAY mengikuti produknya."
      );
    }
    if (!template || !values) {
      return kosong(`Template RIPLAY untuk produk ${produk.nama} belum tersedia.`);
    }
    if (pdfState === "menyiapkan") return kosong("Menyiapkan dokumen RIPLAY …");

    if (pdf) {
      return (
        <iframe
          src={pdf.url}
          title="RIPLAY Personal"
          className={cn(
            "w-full bg-pfi-bg",
            penuh ? "min-h-0 flex-1" : "h-[720px] rounded-[10px] border border-pfi-hairline"
          )}
        />
      );
    }

    return (
      <div className={cn("flex flex-col gap-3", penuh && "min-h-0 flex-1 p-4 sm:p-6")}>
        {pdfCatatan && (
          <p className="rounded-[10px] border border-pfi-line bg-pfi-tint-alt px-4 py-3 text-sm text-pfi-muted">
            {pdfCatatan}
          </p>
        )}
        <RiplayDocument
          templateUrl={templateUrl(template)}
          fill={values}
          ttd={ttd}
          className={
            penuh
              ? "riplay-cetak min-h-0 flex-1 overflow-y-auto"
              : "max-h-[720px] overflow-y-auto"
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FnaHeader backHref={backHref} title="Ilustrasi" />
      <IllustrationStepper current={STEP} leadId={leadId} />

      {message && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}

      <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-pfi-hairline bg-pfi-tint-alt p-4 sm:px-6">
          <h2 className="text-lg font-bold text-pfi-heading">
            Ringkasan Informasi Produk dan Layanan Personal (RIPLAY)
          </h2>

          <button
            type="button"
            onClick={() => setLayarPenuh(true)}
            disabled={!values}
            className="flex items-center gap-3 rounded-[10px] border border-pfi-orange bg-white px-4 py-2.5 text-sm font-medium text-pfi-orange transition hover:bg-pfi-orange/10 disabled:opacity-50"
          >
            <FileText className="size-5" aria-hidden />
            Pratinjau RIPLAY Personal
          </button>
        </header>

        <div className="p-4 sm:p-6">
          <p className="mb-4 rounded-[10px] bg-pfi-bg px-4 py-3 text-sm text-pfi-muted">
            Data nasabah dan angka proyeksi pada dokumen terisi dari ilustrasi ini. Penanda
            yang masih tersisa berarti isiannya belum lengkap atau bagian itu belum punya
            sumber data.
          </p>

          {produk && produk.templates.length > 1 && (
            <div className="mb-4 flex flex-col gap-2.5">
              <p className="text-sm text-pfi-heading">Metode Seleksi Risiko</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {produk.templates.map((item) => {
                  const dipilih = item.id === templateId;

                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 transition",
                        dipilih
                          ? "border-pfi-link bg-pfi-tint-alt"
                          : "border-pfi-line bg-white hover:bg-pfi-hairline"
                      )}
                    >
                      <input
                        type="radio"
                        name="riplay_template"
                        value={item.id}
                        checked={dipilih}
                        onChange={() => void pilihTemplate(item.id)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-5 shrink-0 place-items-center rounded-full border-2",
                          dipilih ? "border-pfi-link" : "border-pfi-line"
                        )}
                      >
                        {dipilih && <span className="size-2.5 rounded-full bg-pfi-link" />}
                      </span>
                      <span className="text-sm font-medium text-pfi-heading">{item.varian}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {dokumen()}
        </div>
      </section>

      <FnaFooter
        backHref={backHref}
        onNext={() => router.push(`${detailHref}/sales-illustration/signature`)}
      />

      {layarPenuh && values && template && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50 p-4">
          <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-pfi-hairline px-5 py-4 sm:px-6">
              <h2 className="text-lg font-bold text-pfi-heading">RIPLAY Personal</h2>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={simpanPdf}
                  className="flex items-center gap-3 rounded-[10px] border border-pfi-orange bg-white px-4 py-2.5 text-sm font-medium text-pfi-orange transition hover:bg-pfi-orange/10"
                >
                  <Printer className="size-5" aria-hidden />
                  Download PDF
                </button>

                <button
                  type="button"
                  onClick={() => void unduh()}
                  disabled={mengunduh}
                  className="flex items-center gap-3 rounded-[10px] bg-pfi-orange px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="size-5" aria-hidden />
                  {mengunduh ? "Menyiapkan …" : "Download Dokumen"}
                </button>

                <button
                  type="button"
                  onClick={() => setLayarPenuh(false)}
                  aria-label="Tutup"
                  className="grid size-9 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </header>

            {dokumen(true)}
          </div>
        </div>
      )}
    </div>
  );
}
