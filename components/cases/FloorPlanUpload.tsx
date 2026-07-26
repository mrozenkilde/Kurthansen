"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_DIMENSION = 2400;

/** Renderer side 1 af en PDF til et PNG-canvas. */
async function pdfToCanvas(file: File): Promise<HTMLCanvasElement> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() })
    .promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(
    4,
    MAX_DIMENSION / Math.max(base.width, base.height)
  );
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas;
}

/** Skalerer et billede ned til max-dimensionen på et canvas. */
async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export default function FloorPlanUpload({ caseId }: { caseId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const canvas = isPdf ? await pdfToCanvas(file) : await imageToCanvas(file);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Kunne ikke konvertere tegningen");

      const supabase = createClient();
      const ts = Date.now();
      const imagePath = `${caseId}/${ts}.png`;

      const { error: uploadError } = await supabase.storage
        .from("floorplans")
        .upload(imagePath, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;

      let originalPath: string | null = null;
      if (isPdf) {
        originalPath = `${caseId}/${ts}-original.pdf`;
        await supabase.storage
          .from("floorplans")
          .upload(originalPath, file, { contentType: "application/pdf" });
      }

      const planName =
        name.trim() || file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, "");
      const { error: insertError } = await supabase.from("floor_plans").insert({
        case_id: caseId,
        name: planName,
        image_path: imagePath,
        original_path: originalPath,
        width: canvas.width,
        height: canvas.height,
      });
      if (insertError) throw insertError;

      setName("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Upload fejlede – prøv igen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-4">
      <p className="text-sm font-medium">Upload plantegning (PDF eller billede)</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn, f.eks. Stueplan"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          {busy ? "Uploader…" : "Vælg fil"}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
