"use client";

import { useEffect, useRef, useState } from "react";
import { createTextFiller, type RiplayFill } from "@/lib/riplay-fill";
import { muatTemplate } from "@/lib/riplay-template";
import { sisipkanTandaTangan, type TandaTanganRiplay } from "@/lib/riplay-signature";

/**
 * Ganti penanda `<...>` pada dokumen yang sudah dirender.
 *
 * TreeWalker berjalan mengikuti urutan dokumen, jadi penanda berulang seperti
 * `<Policy year>` menerima nilai baris yang benar. Penanda yang belum ada
 * datanya dibiarkan apa adanya supaya terlihat bagian mana yang belum terisi.
 */
function isiPlaceholder(root: HTMLElement, fill: RiplayFill) {
  const isi = createTextFiller(fill);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const teks = node.nodeValue;
    if (!teks) continue;

    const diganti = isi(teks);
    if (diganti !== teks) node.nodeValue = diganti;
  }
}

/**
 * Render template RIPLAY (.docx) di browser lalu isi placeholder-nya.
 *
 * docx-preview hanya bisa jalan di browser, jadi di-import saat efek berjalan.
 * Berkasnya disajikan dari public/riplay/; penanda yang terpecah antar-run
 * dirapikan dulu oleh `muatTemplate`.
 */
export function RiplayDocument({
  templateUrl,
  fill,
  ttd,
  className,
}: {
  templateUrl: string;
  fill: RiplayFill;
  /** Tanda tangan yang sudah dibubuhkan di langkah terakhir, bila ada. */
  ttd?: TandaTanganRiplay;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let batal = false;

    (async () => {
      try {
        const [{ renderAsync }, zip] = await Promise.all([
          import("docx-preview"),
          muatTemplate(templateUrl),
        ]);

        await sisipkanTandaTangan(zip, ttd ?? {});

        const blob = await zip.generateAsync({ type: "blob" });
        const target = container.current;
        if (batal || !target) return;

        target.innerHTML = "";
        await renderAsync(blob, target, undefined, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          // Tinggi halaman dipertahankan supaya footer duduk di dasar halaman,
          // bukan menempel di bawah paragraf terakhir.
          ignoreHeight: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          experimental: true,
        });

        if (batal) return;

        isiPlaceholder(target, fill);
        setState("ready");
      } catch (error) {
        if (batal) return;
        setMessage(error instanceof Error ? error.message : "Gagal membuka template RIPLAY.");
        setState("error");
      }
    })();

    return () => {
      batal = true;
    };
  }, [fill, templateUrl, ttd]);

  return (
    <div className={className}>
      {state === "loading" && (
        <p className="py-10 text-center text-sm text-pfi-muted">Menyiapkan dokumen RIPLAY …</p>
      )}
      {state === "error" && (
        <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
          {message}
        </p>
      )}
      <div ref={container} className="riplay-doc overflow-x-auto" />
    </div>
  );
}
