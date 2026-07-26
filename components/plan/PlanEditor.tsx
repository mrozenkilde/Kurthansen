"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { FloorPlan, Point, Room, Wall } from "@/lib/types";
import { distance, pointInPolygon } from "@/lib/geometry";
import ColorPalette from "@/components/plan/ColorPalette";

const PlanStage = dynamic(() => import("./PlanStage"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl bg-slate-200" />
  ),
});

type Tool = "select" | "wall" | "room";

export default function PlanEditor({
  caseId,
  plan,
  imageUrl,
  initialRooms,
  initialWalls,
}: {
  caseId: string;
  plan: FloorPlan;
  imageUrl: string;
  initialRooms: Room[];
  initialWalls: Wall[];
}) {
  const [tool, setTool] = useState<Tool>("select");
  const [walls, setWalls] = useState<Wall[]>(initialWalls);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [draftWall, setDraftWall] = useState<{ start: Point; end: Point } | null>(null);
  const [draftRoomPoints, setDraftRoomPoints] = useState<Point[]>([]);
  const [roomName, setRoomName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const selectedWall = walls.find((w) => w.id === selectedWallId) ?? null;
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  function switchTool(next: Tool) {
    setTool(next);
    setDraftWall(null);
    setDraftRoomPoints([]);
    if (next !== "select") {
      setSelectedRoomId(null);
      if (next === "room") setSelectedWallId(null);
    }
  }

  // ---------- Vægge ----------

  async function finishWallDraw() {
    const draft = draftWall;
    setDraftWall(null);
    if (!draft || distance(draft.start, draft.end) < 0.012) return;

    const midpoint: Point = [
      (draft.start[0] + draft.end[0]) / 2,
      (draft.start[1] + draft.end[1]) / 2,
    ];
    const room = rooms.find((r) => pointInPolygon(midpoint, r.polygon));

    const { data, error } = await supabase
      .from("walls")
      .insert({
        floor_plan_id: plan.id,
        room_id: room?.id ?? null,
        x1: draft.start[0],
        y1: draft.start[1],
        x2: draft.end[0],
        y2: draft.end[1],
      })
      .select("*")
      .single<Wall>();

    if (error || !data) {
      setError("Kunne ikke gemme væggen");
      return;
    }
    setWalls((prev) => [...prev, data]);
    setSelectedWallId(data.id);
  }

  async function updateWall(wallId: string, patch: Partial<Wall>) {
    setWalls((prev) =>
      prev.map((w) => (w.id === wallId ? { ...w, ...patch } : w))
    );
    const { error } = await supabase.from("walls").update(patch).eq("id", wallId);
    if (error) setError("Ændringen kunne ikke gemmes");
  }

  async function deleteWall(wallId: string) {
    if (!confirm("Slet væggen (og dens billeder)?")) return;
    setWalls((prev) => prev.filter((w) => w.id !== wallId));
    setSelectedWallId(null);
    await supabase.from("walls").delete().eq("id", wallId);
  }

  function moveEndpoint(wallId: string, which: 1 | 2, p: Point) {
    setWalls((prev) =>
      prev.map((w) =>
        w.id === wallId
          ? which === 1
            ? { ...w, x1: p[0], y1: p[1] }
            : { ...w, x2: p[0], y2: p[1] }
          : w
      )
    );
  }

  async function releaseEndpoint(wallId: string) {
    const wall = walls.find((w) => w.id === wallId);
    if (!wall) return;
    await supabase
      .from("walls")
      .update({ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 })
      .eq("id", wallId);
  }

  // ---------- Rum ----------

  async function saveRoom() {
    const name = roomName.trim();
    if (draftRoomPoints.length < 3 || !name) return;

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        floor_plan_id: plan.id,
        name,
        polygon: draftRoomPoints,
      })
      .select("*")
      .single<Room>();

    if (error || !data) {
      setError("Kunne ikke gemme rummet");
      return;
    }

    setRooms((prev) => [...prev, data]);

    // Tildel rum-løse vægge, hvis midtpunkt ligger i det nye rum
    const orphans = walls.filter(
      (w) =>
        !w.room_id &&
        pointInPolygon(
          [(w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2],
          draftRoomPoints
        )
    );
    if (orphans.length > 0) {
      const ids = orphans.map((w) => w.id);
      setWalls((prev) =>
        prev.map((w) => (ids.includes(w.id) ? { ...w, room_id: data.id } : w))
      );
      await supabase.from("walls").update({ room_id: data.id }).in("id", ids);
    }

    setDraftRoomPoints([]);
    setRoomName("");
    setTool("select");
    setSelectedRoomId(data.id);
  }

  async function renameRoom(roomId: string, name: string) {
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, name } : r))
    );
    await supabase.from("rooms").update({ name }).eq("id", roomId);
  }

  async function deleteRoom(roomId: string) {
    if (!confirm("Slet rummet? Væggene bevares, men mister rum-tilknytning."))
      return;
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setWalls((prev) =>
      prev.map((w) => (w.room_id === roomId ? { ...w, room_id: null } : w))
    );
    setSelectedRoomId(null);
    await supabase.from("rooms").delete().eq("id", roomId);
  }

  // ---------- Render ----------

  const stageWalls = walls.map((w) => ({
    id: w.id,
    x1: w.x1,
    y1: w.y1,
    x2: w.x2,
    y2: w.y2,
    colorHex: w.color_hex,
  }));

  const toolBtn = (t: Tool, label: string) => (
    <button
      onClick={() => switchTool(t)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        tool === t
          ? "bg-slate-900 text-white"
          : "border border-slate-300 bg-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="pb-64">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href={`/cases/${caseId}`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Tilbage til sagen
          </Link>
          <h1 className="text-xl font-semibold">Redigér · {plan.name}</h1>
        </div>
        <Link
          href={`/cases/${caseId}/plans/${plan.id}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
        >
          Færdig
        </Link>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {toolBtn("select", "Vælg / flyt")}
        {toolBtn("wall", "＋ Væg")}
        {toolBtn("room", "＋ Rum")}
        <span className="text-sm text-slate-500">
          {tool === "select" &&
            "Tryk på en væg eller et rum for at redigere. Træk i håndtagene for at justere en valgt væg."}
          {tool === "wall" && "Tegn en væg: tryk og træk langs væggen."}
          {tool === "room" &&
            "Tryk hjørnerne af rummet af ét ad gangen, og gem med navn nedenfor."}
        </span>
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}{" "}
          <button className="underline" onClick={() => setError(null)}>
            OK
          </button>
        </p>
      )}

      <PlanStage
        imageUrl={imageUrl}
        imgWidth={plan.width}
        imgHeight={plan.height}
        walls={stageWalls}
        rooms={rooms}
        mode={tool === "wall" ? "draw-wall" : tool === "room" ? "draw-room" : "pan"}
        selectedWallId={selectedWallId}
        selectedRoomId={selectedRoomId}
        editableEndpoints={tool === "select"}
        draftWall={draftWall}
        draftRoomPoints={draftRoomPoints}
        onWallTap={(id) => {
          setSelectedWallId(id);
          setSelectedRoomId(null);
        }}
        onRoomTap={(id) => {
          setSelectedRoomId(id);
          setSelectedWallId(null);
        }}
        onBackgroundTap={() => {
          setSelectedWallId(null);
          setSelectedRoomId(null);
        }}
        onDrawStart={(p) => setDraftWall({ start: p, end: p })}
        onDrawMove={(p) =>
          setDraftWall((prev) => (prev ? { ...prev, end: p } : prev))
        }
        onDrawEnd={() => void finishWallDraw()}
        onTapPoint={(p) => setDraftRoomPoints((prev) => [...prev, p])}
        onEndpointMove={moveEndpoint}
        onEndpointRelease={(id) => void releaseEndpoint(id)}
      />

      {/* Panel: nyt rum */}
      {tool === "room" && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-medium">
            Nyt rum · {draftRoomPoints.length} punkt
            {draftRoomPoints.length === 1 ? "" : "er"}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Rummets navn, f.eks. Stue"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <button
              onClick={() => void saveRoom()}
              disabled={draftRoomPoints.length < 3 || !roomName.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Gem rum
            </button>
            <button
              onClick={() => setDraftRoomPoints((prev) => prev.slice(0, -1))}
              disabled={draftRoomPoints.length === 0}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              Fortryd punkt
            </button>
            <button
              onClick={() => {
                setDraftRoomPoints([]);
                setRoomName("");
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            >
              Ryd
            </button>
          </div>
          {draftRoomPoints.length < 3 && (
            <p className="mt-2 text-sm text-slate-500">
              Markér mindst 3 hjørner på tegningen.
            </p>
          )}
        </div>
      )}

      {/* Panel: valgt væg */}
      {selectedWall && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">
              Væg
              {selectedWall.color_name ? ` · ${selectedWall.color_name}` : ""}
            </h2>
            <button
              onClick={() => void deleteWall(selectedWall.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
            >
              Slet væg
            </button>
          </div>

          <div className="mt-3">
            <label className="block text-sm font-medium">Rum</label>
            <select
              value={selectedWall.room_id ?? ""}
              onChange={(e) =>
                void updateWall(selectedWall.id, {
                  room_id: e.target.value || null,
                })
              }
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
            >
              <option value="">(intet rum)</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium">Vægfarve</label>
            <ColorPalette
              valueHex={selectedWall.color_hex}
              onSelect={(color) =>
                void updateWall(selectedWall.id, {
                  color_hex: color?.hex ?? null,
                  color_name: color?.name ?? null,
                })
              }
            />
          </div>
        </div>
      )}

      {/* Panel: valgt rum */}
      {selectedRoom && !selectedWall && (
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Rum · {selectedRoom.name}</h2>
            <button
              onClick={() => void deleteRoom(selectedRoom.id)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
            >
              Slet rum
            </button>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium">Navn</label>
            <input
              defaultValue={selectedRoom.name}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== selectedRoom.name)
                  void renameRoom(selectedRoom.id, name);
              }}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {walls.filter((w) => w.room_id === selectedRoom.id).length} vægge i
            rummet
          </p>
        </div>
      )}
    </div>
  );
}
