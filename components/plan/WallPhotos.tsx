"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { PHOTO_TYPE_LABELS, type Photo, type PhotoType } from "@/lib/types";

interface PhotoWithUrl extends Photo {
  url?: string;
}

export default function WallPhotos({
  caseId,
  wallId,
  isAdmin,
  onCountChange,
}: {
  caseId: string;
  wallId: string;
  isAdmin: boolean;
  onCountChange?: (wallId: string, count: number) => void;
}) {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoType, setPhotoType] = useState<PhotoType>("dokumentation");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("wall_id", wallId)
      .order("created_at", { ascending: false })
      .returns<Photo[]>();

    const rows = data ?? [];
    let withUrls: PhotoWithUrl[] = rows;
    if (rows.length > 0) {
      const { data: signed } = await supabase.storage
        .from("photos")
        .createSignedUrls(
          rows.map((p) => p.storage_path),
          3600
        );
      withUrls = rows.map((p, i) => ({
        ...p,
        url: signed?.[i]?.signedUrl ?? undefined,
      }));
    }
    setPhotos(withUrls);
    setLoading(false);
    onCountChange?.(wallId, rows.length);
  }, [wallId, onCountChange]);

  useEffect(() => {
    // Datahentning ved mount – setState sker først efter await i load()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const blob = await compressImage(file);
      const path = `${caseId}/${wallId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("photos").insert({
        wall_id: wallId,
        type: photoType,
        storage_path: path,
        taken_by: user?.id,
      });
      if (insertError) throw insertError;

      await load();
    } catch (err) {
      console.error(err);
      setError("Upload fejlede – prøv igen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(photo: PhotoWithUrl) {
    if (!confirm("Slet billedet?")) return;
    const supabase = createClient();
    await supabase.from("photos").delete().eq("id", photo.id);
    await supabase.storage.from("photos").remove([photo.storage_path]);
    await load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white ${
            uploading ? "opacity-50" : ""
          }`}
        >
          {uploading ? "Uploader…" : "📷 Tag billede"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
        <select
          value={photoType}
          onChange={(e) => setPhotoType(e.target.value as PhotoType)}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none"
        >
          <option value="dokumentation">Dokumentation</option>
          <option value="kvalitetssikring">Kvalitetssikring (KS)</option>
        </select>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Henter billeder…</p>
      ) : photos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Ingen billeder af denne væg endnu.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt={PHOTO_TYPE_LABELS[p.type]}
                  onClick={() => setPreview(p.url ?? null)}
                  className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
                />
              )}
              <span
                className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${
                  p.type === "kvalitetssikring" ? "bg-indigo-600" : "bg-slate-700/80"
                }`}
              >
                {p.type === "kvalitetssikring" ? "KS" : "DOK"}
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(p)}
                  className="absolute right-1 top-1 hidden h-6 w-6 rounded-full bg-black/60 text-xs text-white group-hover:block"
                  title="Slet billede"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Fuldskærms-forhåndsvisning */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Billede"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}
