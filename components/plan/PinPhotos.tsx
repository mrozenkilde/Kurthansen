"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import type { Photo } from "@/lib/types";

interface PhotoWithUrl extends Photo {
  url?: string;
}

export default function PinPhotos({
  caseId,
  pinId,
  canDelete,
  onCountChange,
}: {
  caseId: string;
  pinId: string;
  canDelete: boolean;
  onCountChange?: (pinId: string, count: number) => void;
}) {
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("photos")
      .select("*")
      .eq("pin_id", pinId)
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
    onCountChange?.(pinId, rows.length);
  }, [pinId, onCountChange]);

  useEffect(() => {
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
      const path = `${caseId}/pins/${pinId}/${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("photos").insert({
        pin_id: pinId,
        wall_id: null,
        type: "dokumentation",
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
      <label
        className={`inline-block cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white ${
          uploading ? "opacity-50" : ""
        }`}
      >
        {uploading ? "Uploader…" : "📷 Tag / vælg billede"}
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

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-3 text-sm text-slate-500">Henter billeder…</p>
      ) : photos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Ingen billeder endnu.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.url}
                  alt="Foto"
                  onClick={() => setPreview(p.url ?? null)}
                  className="aspect-square w-full cursor-zoom-in rounded-lg object-cover"
                />
              )}
              {canDelete && (
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
