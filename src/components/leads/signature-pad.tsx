"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, X } from "lucide-react";

/**
 * Kanvas tanda tangan.
 *
 * Goresan diambil dari pointer event supaya jari, pena, dan tetikus tertangani
 * sama. Kanvas digambar pada resolusi perangkat agar hasilnya tidak buram di
 * layar rapat, lalu disimpan sebagai PNG data URL.
 */
export function SignaturePad({
  title,
  onSave,
  onClose,
}: {
  title: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const menggambar = useRef(false);
  const [adaGoresan, setAdaGoresan] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;

    const rasio = window.devicePixelRatio || 1;
    const kotak = el.getBoundingClientRect();

    el.width = Math.round(kotak.width * rasio);
    el.height = Math.round(kotak.height * rasio);

    const ctx = el.getContext("2d");
    if (!ctx) return;

    ctx.scale(rasio, rasio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#101828";
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  function titik(event: React.PointerEvent<HTMLCanvasElement>) {
    const kotak = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - kotak.left, y: event.clientY - kotak.top };
  }

  function mulai(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    menggambar.current = true;

    const { x, y } = titik(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function gores(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!menggambar.current) return;

    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;

    const { x, y } = titik(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setAdaGoresan(true);
  }

  function selesai() {
    menggambar.current = false;
  }

  function bersihkan() {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.restore();
    setAdaGoresan(false);
  }

  function simpan() {
    const el = canvas.current;
    if (!el || !adaGoresan) return;
    onSave(el.toDataURL("image/png"));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-pfi-hairline px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-pfi-heading">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-9 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="p-5 sm:p-6">
          <p className="mb-3 text-sm text-pfi-muted">
            Bubuhkan tanda tangan di dalam kotak menggunakan jari, pena, atau tetikus.
          </p>

          <canvas
            ref={canvas}
            onPointerDown={mulai}
            onPointerMove={gores}
            onPointerUp={selesai}
            onPointerLeave={selesai}
            onPointerCancel={selesai}
            className="h-64 w-full touch-none rounded-[10px] border border-dashed border-pfi-line bg-white"
          />
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-pfi-hairline px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={bersihkan}
            className="flex items-center gap-2.5 rounded-[10px] border border-pfi-line bg-white px-4 py-2.5 text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline"
          >
            <Eraser className="size-5" aria-hidden />
            Bersihkan
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={simpan}
              disabled={!adaGoresan}
              title={adaGoresan ? undefined : "Belum ada goresan tanda tangan"}
              className="rounded-[10px] bg-pfi-orange px-6 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              Simpan
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
