"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { FloorPlan, Note, Room, Wall } from "@/lib/types";
import { WALL_STATUS_LABELS } from "@/lib/types";
import WallPhotos from "@/components/plan/WallPhotos";
import RoomNotes from "@/components/plan/RoomNotes";

const PlanStage = dynamic(() => import("./PlanStage"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl bg-slate-200" />
  ),
});

export default function PlanViewer({
  caseId,
  plan,
  imageUrl,
  rooms,
  walls,
  notes,
  photoCounts: initialPhotoCounts,
  isAdmin,
  myName,
}: {
  caseId: string;
  plan: FloorPlan;
  imageUrl: string;
  rooms: Room[];
  walls: Wall[];
  notes: Note[];
  photoCounts: Record<string, number>;
  isAdmin: boolean;
  myName: string;
}) {
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [photoCounts, setPhotoCounts] = useState(initialPhotoCounts);

  const selectedWall = walls.find((w) => w.id === selectedWallId) ?? null;
  const wallRoom = selectedWall?.room_id
    ? rooms.find((r) => r.id === selectedWall.room_id) ?? null
    : null;
  const selectedRoom = selectedRoomId
    ? rooms.find((r) => r.id === selectedRoomId) ?? null
    : null;

  const activeRoom = wallRoom ?? selectedRoom;
  const roomNotes = useMemo(
    () => (activeRoom ? notes.filter((n) => n.room_id === activeRoom.id) : []),
    [notes, activeRoom]
  );

  const handleCountChange = useCallback((wallId: string, count: number) => {
    setPhotoCounts((prev) =>
      prev[wallId] === count ? prev : { ...prev, [wallId]: count }
    );
  }, []);

  const stageWalls = walls.map((w) => ({
    id: w.id,
    x1: w.x1,
    y1: w.y1,
    x2: w.x2,
    y2: w.y2,
    colorHex: w.color_hex,
    hasPhoto: (photoCounts[w.id] ?? 0) > 0,
  }));

  const sheetOpen = Boolean(selectedWall || selectedRoom);

  function closeSheet() {
    setSelectedWallId(null);
    setSelectedRoomId(null);
  }

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
          <h1 className="text-xl font-semibold">{plan.name}</h1>
        </div>
        {isAdmin && (
          <Link
            href={`/cases/${caseId}/plans/${plan.id}/edit`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
          >
            Redigér tegning
          </Link>
        )}
      </div>

      {walls.length === 0 ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">Tegningen er ikke markeret endnu</p>
          <p className="mt-1 text-amber-900/90">
            Selve PDF’en er kun baggrund. Du skal først tegne vægge (og gerne
            rum) ovenpå, før man kan trykke på dem og tage billeder.
          </p>
          {isAdmin && (
            <Link
              href={`/cases/${caseId}/plans/${plan.id}/edit`}
              className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Gå til Redigér tegning
            </Link>
          )}
        </div>
      ) : (
        <p className="mb-2 text-sm text-slate-500">
          Tryk på en <span className="font-medium text-slate-700">farvet streg</span>{" "}
          (en markeret væg) for at tage billede. Tryk på et rum for noter. Grøn
          prik = væggen har billeder.
        </p>
      )}

      <PlanStage
        imageUrl={imageUrl}
        imgWidth={plan.width}
        imgHeight={plan.height}
        walls={stageWalls}
        rooms={rooms}
        mode="pan"
        selectedWallId={selectedWallId}
        selectedRoomId={selectedRoomId}
        onWallTap={(id) => {
          setSelectedWallId(id);
          setSelectedRoomId(null);
        }}
        onRoomTap={(id) => {
          setSelectedRoomId(id);
          setSelectedWallId(null);
        }}
        onBackgroundTap={closeSheet}
      />

      {/* Bundpanel */}
      {sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-5 shadow-2xl">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                {selectedWall ? (
                  <>
                    <h2 className="text-lg font-semibold">
                      Væg{wallRoom ? ` · ${wallRoom.name}` : " (uden rum)"}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span
                        className="inline-block h-5 w-5 rounded-full border border-slate-300 align-middle"
                        style={{
                          backgroundColor: selectedWall.color_hex ?? "#e2e8f0",
                        }}
                      />
                      <span>
                        {selectedWall.color_name ?? "Ingen farve valgt"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span>{WALL_STATUS_LABELS[selectedWall.status]}</span>
                    </div>
                  </>
                ) : (
                  <h2 className="text-lg font-semibold">
                    {selectedRoom?.name}
                  </h2>
                )}
              </div>
              <button
                onClick={closeSheet}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm"
              >
                Luk
              </button>
            </div>

            {selectedWall && (
              <div className="mt-4">
                <WallPhotos
                  key={selectedWall.id}
                  caseId={caseId}
                  wallId={selectedWall.id}
                  isAdmin={isAdmin}
                  onCountChange={handleCountChange}
                />
              </div>
            )}

            {activeRoom && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h3 className="mb-2 text-sm font-semibold text-slate-500">
                  Noter · {activeRoom.name}
                </h3>
                <RoomNotes
                  key={activeRoom.id}
                  roomId={activeRoom.id}
                  initialNotes={roomNotes}
                  authorName={myName}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
