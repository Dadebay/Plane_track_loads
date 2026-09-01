"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X } from "lucide-react";

/**
 * Camera-based QR/barcode scan for fast ULD lookup on ramp tablets/phones
 * (Faz 7 kabul kriteri). Uses the native Barcode Detection API — supported
 * on Chromium-based mobile browsers — with no scanning library dependency.
 * Falls back to a clear "not supported" message on browsers without it
 * (e.g. iOS Safari) rather than pretending to scan.
 */
export function UldScanButton({ onScan }: { onScan: (code: string) => void }) {
  const t = useTranslations("uld.list");
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
      setSupported(false);
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let stream: MediaStream | null = null;
    const detector = new BarcodeDetector({ formats: ["qr_code", "code_128", "code_39", "ean_13"] });

    async function tick() {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && codes[0]) {
          onScan(codes[0].rawValue);
          setOpen(false);
          return;
        }
      } catch {
        // Frame not decodable yet — keep polling.
      }
      if (!cancelled) rafId = requestAnimationFrame(tick);
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => setSupported(false));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [open, onScan]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSupported(true);
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-fg hover:bg-bg-muted"
      >
        <Camera className="h-4 w-4" aria-hidden="true" />
        {t("scan")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("scanClose")}
            className="absolute right-4 top-4 rounded-full p-2 text-white hover:bg-white/10"
          >
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
          {supported ? (
            <>
              <video ref={videoRef} muted playsInline className="max-h-[70vh] w-full max-w-md rounded-lg" />
              <p className="mt-4 text-sm text-white">{t("scanPrompt")}</p>
            </>
          ) : (
            <p className="max-w-xs text-center text-sm text-white">{t("scanNotSupported")}</p>
          )}
        </div>
      ) : null}
    </>
  );
}
