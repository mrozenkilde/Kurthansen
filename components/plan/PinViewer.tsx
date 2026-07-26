"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FloorPlan, Pin } from "@/lib/types";
import PinPhotos from "@/components/plan/PinPhotos";

const PinStage = dynamic(() => import("./PinStage"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl bg-slate-200" />
  ),
});

export default function PinViewer({
  caseId,
  plan,
  imageUrl,
  initialPins,
}: {
  caseId: string;
  plan: FloorPlan;
  imageUrl: string;
  initialPins: Pin[];
  isAdmin?: boolean;
}) {
  const [pins, setPins] = useState<Pin[]>(initialPins);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      initialPins.map((p) => [p.id, p.photo_count ?? 0])
    )
  );

  const selected = pins.find((p) => p.id === selectedPinId) ?? null;

  function selectPin(id: string) {
    const pin = pins.find((p) => p.id === id);
    setSelectedPinId(id);
    setNoteDraft(pin?.note ?? "");
    setError(null);
  }

  async function placePin(x: number, y: number) {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("pins")
      .insert({
        floor_plan_id: plan.id,
        x,
        y,
        note: "",
        created_by: user?.id,
      })
      .select("*")
      .single<Pin>();
    setBusy(false);
    if (error || !data) {
      setError(
        error?.message?.includes("relation") || error?.code === "42P01"
          ? "Pin-tabellen mangler i Supabase. Kør migrationsfilen 0002_pins.sql i SQL Editor."
          : "Kunne ikke oprette pin – prøv igen"
      );
      return;
    }
    setPins((prev) => [...prev, data]);
    setPhotoCounts((prev) => ({ ...prev, [data.id]: 0 }));
    selectPin(data.id);
  }

  async function saveNote() {
    if (!selected) return;
    setSavingNote(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("pins")
      .update({ note: noteDraft.trim() })
      .eq("id", selected.id);
    setSavingNote(false);
    if (error) {
      setError("Kunne ikke gemme teksten");
      return;
    }
    setPins((prev) =>
      prev.map((p) =>
        p.id === selected.id ? { ...p, note: noteDraft.trim() } : p
      )
    );
  }

  async function deletePin() {
    if (!selected) return;
    if (!confirm("Slet denne pin og dens billeder?")) return;
    const supabase = createClient();
    await supabase.from("pins").delete().eq("id", selected.id);
    setPins((prev) => prev.filter((p) => p.id !== selected.id));
    setSelectedPinId(null);
  }

  const handleCountChange = useCallback((pinId: string, count: number) => {
    setPhotoCounts((prev) =>
      prev[pinId] === count ? prev : { ...prev, [pinId]: count }
    );
  }, []);

  const pinsWithMeta = pins.map((p) => ({
    ...p,
    photo_count: photoCounts[p.id] ?? 0,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href={`/cases/${caseId}`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Tilbage til sagen
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{plan.name}</h1>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        Tryk på tegningen for at sætte en <span className="font-medium">pin</span>.
        Tilknyt derefter billede og en kort tekst. Zoom med +/− eller to fingre.
      </p>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <PinStage
        imageUrl={imageUrl}
        imgWidth={plan.width}
        imgHeight={plan.height}
        pins={pinsWithMeta}
        selectedPinId={selectedPinId}
        onSelectPin={selectPin}
        onPlacePin={(x, y) => {
          if (!busy) void placePin(x, y);
        }}
      />

      {pins.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {pins.length} pin{pins.length === 1 ? "" : "s"} på tegningen
          {busy ? " · Opretter…" : ""}
        </p>
      )}

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Pin</h2>
                <p className="text-xs text-slate-500">
                  {new Date(selected.created_at).toLocaleString("da-DK", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void deletePin()}
                  className="rounded-full border border-red-200 px-3 py-1 text-sm text-red-600"
                >
                  Slet
                </button>
                <button
                  onClick={() => setSelectedPinId(null)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm"
                >
                  Luk
                </button>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium">Kort tekst</label>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={() => {
                  if (noteDraft.trim() !== selected.note) void saveNote();
                }}
                rows={3}
                placeholder="F.eks. Beskidte vægge på den store trappe"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
              />
              <button
                onClick={() => void saveNote()}
                disabled={savingNote}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {savingNote ? "Gemmer…" : "Gem tekst"}
              </button>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-500">
                Billeder
              </h3>
              <PinPhotos
                key={selected.id}
                caseId={caseId}
                pinId={selected.id}
                canDelete
                onCountChange={handleCountChange}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
