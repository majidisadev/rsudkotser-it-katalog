"use client";

import { Camera, PenLine, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ProofCapture (DSD UX-004) — bukti dua-tab:
 *  • **Foto**: kamera langsung (`getUserMedia`) — tanpa unggah berkas.
 *  • **Tanda tangan**: kanvas gambar tangan — jalur setara bila kamera
 *    ditolak/absen (PRD R2/FR10, a11y).
 * Gambar dikompres di client sebelum dikirim (SDD ADR-005); server tetap
 * otoritas final (re-encode + strip EXIF). Memanggil `onChange(file|null)`.
 */
type Tab = "foto" | "tanda-tangan";

async function compress(file: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  try {
    return await imageCompression(file, {
      maxSizeMB: 0.6,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
    });
  } catch {
    return file; // server tetap mengompres ulang — jangan blok bila gagal
  }
}

export function ProofCapture({ onChange }: { onChange: (file: File | null) => void }) {
  const [tab, setTab] = useState<Tab>("foto");
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const clear = useCallback(() => {
    setPreview(null);
    onChange(null);
  }, [onChange]);

  const accept = useCallback(
    async (file: File) => {
      const compressed = await compress(file);
      setPreview(URL.createObjectURL(compressed));
      onChange(compressed);
    },
    [onChange],
  );

  return (
    <div className="rounded-pearl border border-hairline bg-surface p-3">
      <div className="mb-3 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Jenis bukti">
        <TabButton active={tab === "foto"} onClick={() => setTab("foto")} icon={<Camera size={16} aria-hidden />}>
          Foto
        </TabButton>
        <TabButton
          active={tab === "tanda-tangan"}
          onClick={() => setTab("tanda-tangan")}
          icon={<PenLine size={16} aria-hidden />}
        >
          Tanda tangan
        </TabButton>
      </div>

      {tab === "foto" ? (
        preview ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Pratinjau bukti" className="max-h-48 rounded-inline border border-hairline" />
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 text-[14px] font-[600] text-primary"
            >
              <RefreshCw size={14} aria-hidden /> Ulangi
            </button>
          </div>
        ) : (
          <PhotoTab onAccept={accept} onCameraDenied={() => { setCameraError(true); setTab("tanda-tangan"); }} />
        )
      ) : (
        // Kanvas tetap hidup (bukan diganti pratinjau) → bisa dicoret berulang;
        // tiap coretan memperbarui file, "Bersihkan" mengosongkan.
        <SignatureTab onChange={onChange} cameraDeniedNote={cameraError} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[14px] font-[600] transition-colors ${
        active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/** Tab Foto: buka kamera → jepret, atau unggah berkas. */
function PhotoTab({
  onAccept,
  onCameraDenied,
}: {
  onAccept: (file: File) => void;
  onCameraDenied: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  // Pasang stream SETELAH <video> ter-mount (live=true) — bukan sebelumnya, saat
  // videoRef masih null (menyebabkan preview hitam).
  useEffect(() => {
    const video = videoRef.current;
    if (live && streamRef.current && video) {
      video.srcObject = streamRef.current;
      video.play().catch(() => {});
    }
  }, [live]);

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // kamera depan
        audio: false,
      });
      streamRef.current = stream;
      setLive(true); // mount <video> → effect di atas memasang srcObject
    } catch {
      stopCamera();
      onCameraDenied();
    }
  }, [onCameraDenied, stopCamera]);

  const snap = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onAccept(new File([blob], "bukti.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  }, [onAccept, stopCamera]);

  return (
    <div className="flex flex-col items-center gap-3">
      {live ? (
        <>
          <video ref={videoRef} playsInline muted className="max-h-48 w-full rounded-inline bg-black object-contain" />
          <button
            type="button"
            onClick={snap}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 text-[15px] font-[600] text-primary-fg active:scale-[0.96]"
          >
            <Camera size={18} aria-hidden /> Jepret
          </button>
        </>
      ) : (
        <div className="flex w-full flex-col gap-2 py-2">
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[15px] font-[600] text-primary-fg active:scale-[0.96]"
          >
            <Camera size={18} aria-hidden /> Buka kamera
          </button>
          <p className="text-center text-[13px] text-ink-muted">
            Ambil foto langsung dari kamera. Tak bisa akses kamera? Pakai tab Tanda tangan.
          </p>
        </div>
      )}
    </div>
  );
}

/** Tab Tanda tangan: kanvas gambar tangan (pointer) — dapat dicoret berulang. */
function SignatureTab({
  onChange,
  cameraDeniedNote,
}: {
  onChange: (file: File | null) => void;
  cameraDeniedNote: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const prime = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1d1d1f";
  }, []);

  useEffect(prime, [prime]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Kanvas di-render lebih lebar via CSS (`w-full`) daripada buffer 320×180 →
    // skala koordinat pointer ke ruang buffer agar coretan mengikuti kursor.
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    dirty.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!dirty.current) return;
    // Simpan seluruh isi kanvas (semua coretan sejauh ini) sebagai file bukti.
    canvasRef.current?.toBlob(
      async (blob) => {
        if (blob) onChange(await compress(new File([blob], "tanda-tangan.jpg", { type: "image/jpeg" })));
      },
      "image/jpeg",
      0.92,
    );
  };
  const clearCanvas = () => {
    dirty.current = false;
    prime();
    onChange(null);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {cameraDeniedNote ? (
        <p className="w-full rounded-inline bg-surface-2 px-3 py-2 text-[13px] text-ink-muted">
          Kami tidak bisa mengakses kamera. Gunakan tanda tangan sebagai gantinya.
        </p>
      ) : null}
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-inline border border-hairline bg-white"
        aria-label="Area tanda tangan"
      />
      <button
        type="button"
        onClick={clearCanvas}
        className="text-[14px] font-[600] text-primary"
      >
        Bersihkan
      </button>
    </div>
  );
}
