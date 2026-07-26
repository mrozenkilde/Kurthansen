"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line,
  Circle,
  Text,
} from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Point } from "@/lib/types";
import { distanceToSegment, pointInPolygon, polygonCentroid } from "@/lib/geometry";

export interface StageWall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorHex: string | null;
  hasPhoto?: boolean;
}

export interface StageRoom {
  id: string;
  name: string;
  polygon: Point[];
}

export type StageMode = "pan" | "draw-wall" | "draw-room";

interface PlanStageProps {
  imageUrl: string;
  imgWidth: number;
  imgHeight: number;
  walls: StageWall[];
  rooms: StageRoom[];
  mode: StageMode;
  selectedWallId?: string | null;
  selectedRoomId?: string | null;
  editableEndpoints?: boolean;
  draftWall?: { start: Point; end: Point } | null;
  draftRoomPoints?: Point[];
  onWallTap?: (id: string) => void;
  onRoomTap?: (id: string) => void;
  onBackgroundTap?: () => void;
  onDrawStart?: (p: Point) => void;
  onDrawMove?: (p: Point) => void;
  onDrawEnd?: () => void;
  onTapPoint?: (p: Point) => void;
  onEndpointMove?: (wallId: string, which: 1 | 2, p: Point) => void;
  onEndpointRelease?: (wallId: string) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function touchDistance(t1: Touch, t2: Touch) {
  return Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
}
function touchCenter(t1: Touch, t2: Touch) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

export default function PlanStage({
  imageUrl,
  imgWidth,
  imgHeight,
  walls,
  rooms,
  mode,
  selectedWallId,
  selectedRoomId,
  editableEndpoints,
  draftWall,
  draftRoomPoints,
  onWallTap,
  onRoomTap,
  onBackgroundTap,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  onTapPoint,
  onEndpointMove,
  onEndpointRelease,
}: PlanStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const drawingRef = useRef(false);
  const pinchRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Indlæs plantegningen
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => setImage(img);
  }, [imageUrl]);

  // Følg containerens bredde
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const maxH = Math.max(320, window.innerHeight * 0.62);
      const h = Math.min((w * imgHeight) / imgWidth, maxH);
      setSize({ w, h });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imgWidth, imgHeight]);

  const baseScale =
    size.w > 0 ? Math.min(size.w / imgWidth, size.h / imgHeight) : 1;
  const layerX = (size.w - imgWidth * baseScale) / 2;
  const layerY = (size.h - imgHeight * baseScale) / 2;

  // Stregbredde i billed-pixels
  const wallWidth = Math.max(6, imgWidth * 0.011);
  const fontSize = Math.max(14, imgWidth * 0.018);

  function getNormPoint(): Point | null {
    const layer = layerRef.current;
    if (!layer) return null;
    const pos = layer.getRelativePointerPosition();
    if (!pos) return null;
    return [clamp01(pos.x / imgWidth), clamp01(pos.y / imgHeight)];
  }

  function zoomBy(factor: number, center?: { x: number; y: number }) {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.min(10, Math.max(0.4, oldScale * factor));
    const c = center ?? { x: size.w / 2, y: size.h / 2 };
    const pointTo = {
      x: (c.x - stage.x()) / oldScale,
      y: (c.y - stage.y()) / oldScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: c.x - pointTo.x * newScale,
      y: c.y - pointTo.y * newScale,
    });
    stage.batchDraw();
  }

  function resetView() {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
  }

  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    zoomBy(e.evt.deltaY > 0 ? 1 / 1.08 : 1.08, pointer);
  }

  function handleTouchMove(e: KonvaEventObject<TouchEvent>) {
    const stage = stageRef.current;
    if (!stage) return;
    const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];

    if (t1 && t2) {
      // Pinch-zoom
      e.evt.preventDefault();
      if (stage.isDragging()) stage.stopDrag();
      drawingRef.current = false;
      const dist = touchDistance(t1, t2);
      const center = touchCenter(t1, t2);
      if (!pinchRef.current) {
        pinchRef.current = { dist, center };
        return;
      }
      const rect = containerRef.current!.getBoundingClientRect();
      const localCenter = { x: center.x - rect.left, y: center.y - rect.top };
      zoomBy(dist / pinchRef.current.dist, localCenter);
      // Panorér med pinch-centrum
      const dx = center.x - pinchRef.current.center.x;
      const dy = center.y - pinchRef.current.center.y;
      stage.position({ x: stage.x() + dx, y: stage.y() + dy });
      pinchRef.current = { dist, center };
      return;
    }

    if (drawingRef.current && mode === "draw-wall") {
      e.evt.preventDefault();
      const p = getNormPoint();
      if (p) onDrawMove?.(p);
    }
  }

  function handlePointerDown() {
    if (mode !== "draw-wall") return;
    const p = getNormPoint();
    if (!p) return;
    drawingRef.current = true;
    onDrawStart?.(p);
  }

  function handlePointerMove() {
    if (!drawingRef.current || mode !== "draw-wall") return;
    const p = getNormPoint();
    if (p) onDrawMove?.(p);
  }

  function handlePointerUp() {
    pinchRef.current = null;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onDrawEnd?.();
  }

  function handleStageClick(e: KonvaEventObject<MouseEvent | TouchEvent>) {
    if (mode === "draw-room") {
      const p = getNormPoint();
      if (p) onTapPoint?.(p);
      return;
    }
    if (mode !== "pan") return;

    // Hvis man ramte en Line/Circle direkte, har dens egen handler allerede kørt.
    if (e.target !== e.target.getStage()) return;

    // Fallback: find nærmeste væg/rum, hvis Konva ikke ramte stregen præcist
    // (især relevant på touch, hvor stage-drag kan “spise” klikket).
    const p = getNormPoint();
    if (p) {
      let bestWall: { id: string; dist: number } | null = null;
      for (const wall of walls) {
        const dist = distanceToSegment(p, [wall.x1, wall.y1], [wall.x2, wall.y2]);
        if (!bestWall || dist < bestWall.dist) {
          bestWall = { id: wall.id, dist };
        }
      }
      // ~2 % af tegningens bredde som hit-tolerance
      if (bestWall && bestWall.dist < 0.02) {
        onWallTap?.(bestWall.id);
        return;
      }

      for (let i = rooms.length - 1; i >= 0; i--) {
        const room = rooms[i];
        if (room.polygon.length >= 3 && pointInPolygon(p, room.polygon)) {
          onRoomTap?.(room.id);
          return;
        }
      }
    }

    onBackgroundTap?.();
  }

  const selectableShapes = mode === "pan";

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      style={{ touchAction: "none" }}
    >
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        draggable={mode === "pan"}
        dragDistance={8}
        onWheel={handleWheel}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={(e: KonvaEventObject<TouchEvent>) => {
          if (e.evt.touches.length === 1) handlePointerDown();
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handlePointerUp}
        onClick={handleStageClick}
        onTap={handleStageClick}
      >
        <Layer
          ref={layerRef}
          x={layerX}
          y={layerY}
          scaleX={baseScale}
          scaleY={baseScale}
        >
          {image && (
            <KonvaImage
              image={image}
              width={imgWidth}
              height={imgHeight}
              listening={false}
            />
          )}

          {/* Rum */}
          {rooms.map((room) => {
            if (room.polygon.length < 3) return null;
            const flat = room.polygon.flatMap(([x, y]) => [
              x * imgWidth,
              y * imgHeight,
            ]);
            const [cx, cy] = polygonCentroid(room.polygon);
            const selected = room.id === selectedRoomId;
            return (
              <Line
                key={room.id}
                points={flat}
                closed
                fill={
                  selected ? "rgba(37, 99, 235, 0.16)" : "rgba(100,116,139,0.07)"
                }
                stroke={selected ? "#2563eb" : "rgba(100,116,139,0.45)"}
                strokeWidth={wallWidth * 0.25}
                dash={[wallWidth, wallWidth * 0.8]}
                listening={selectableShapes}
                onClick={(e) => {
                  e.cancelBubble = true;
                  onRoomTap?.(room.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onRoomTap?.(room.id);
                }}
                name={`room-${cx}-${cy}`}
              />
            );
          })}

          {/* Rum-labels */}
          {rooms.map((room) => {
            if (room.polygon.length < 3) return null;
            const [cx, cy] = polygonCentroid(room.polygon);
            return (
              <Text
                key={`label-${room.id}`}
                x={cx * imgWidth - imgWidth * 0.15}
                y={cy * imgHeight - fontSize / 2}
                width={imgWidth * 0.3}
                align="center"
                text={room.name}
                fontSize={fontSize}
                fontStyle="bold"
                fill="#334155"
                listening={false}
              />
            );
          })}

          {/* Markering af valgt væg (underlag) */}
          {walls
            .filter((w) => w.id === selectedWallId)
            .map((w) => (
              <Line
                key={`sel-${w.id}`}
                points={[
                  w.x1 * imgWidth,
                  w.y1 * imgHeight,
                  w.x2 * imgWidth,
                  w.y2 * imgHeight,
                ]}
                stroke="#2563eb"
                strokeWidth={wallWidth * 2.1}
                lineCap="round"
                opacity={0.45}
                listening={false}
              />
            ))}

          {/* Vægge */}
          {walls.map((wall) => (
            <Line
              key={wall.id}
              points={[
                wall.x1 * imgWidth,
                wall.y1 * imgHeight,
                wall.x2 * imgWidth,
                wall.y2 * imgHeight,
              ]}
              stroke={wall.colorHex ?? "#94a3b8"}
              strokeWidth={wallWidth}
              lineCap="round"
              opacity={0.92}
              hitStrokeWidth={wallWidth * 5}
              listening={selectableShapes}
              onClick={(e) => {
                e.cancelBubble = true;
                onWallTap?.(wall.id);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onWallTap?.(wall.id);
              }}
            />
          ))}

          {/* Foto-badge på vægge med billeder */}
          {walls
            .filter((w) => w.hasPhoto)
            .map((w) => (
              <Circle
                key={`photo-${w.id}`}
                x={((w.x1 + w.x2) / 2) * imgWidth}
                y={((w.y1 + w.y2) / 2) * imgHeight}
                radius={wallWidth * 0.55}
                fill="#16a34a"
                stroke="#ffffff"
                strokeWidth={wallWidth * 0.18}
                listening={false}
              />
            ))}

          {/* Kladde: væg under tegning */}
          {draftWall && (
            <Line
              points={[
                draftWall.start[0] * imgWidth,
                draftWall.start[1] * imgHeight,
                draftWall.end[0] * imgWidth,
                draftWall.end[1] * imgHeight,
              ]}
              stroke="#2563eb"
              strokeWidth={wallWidth}
              lineCap="round"
              dash={[wallWidth, wallWidth * 0.7]}
              opacity={0.8}
              listening={false}
            />
          )}

          {/* Kladde: rum-polygon under tegning */}
          {draftRoomPoints && draftRoomPoints.length > 0 && (
            <>
              <Line
                points={draftRoomPoints.flatMap(([x, y]) => [
                  x * imgWidth,
                  y * imgHeight,
                ])}
                stroke="#2563eb"
                strokeWidth={wallWidth * 0.3}
                dash={[wallWidth * 0.8, wallWidth * 0.6]}
                listening={false}
              />
              {draftRoomPoints.map(([x, y], i) => (
                <Circle
                  key={i}
                  x={x * imgWidth}
                  y={y * imgHeight}
                  radius={wallWidth * 0.55}
                  fill="#2563eb"
                  listening={false}
                />
              ))}
            </>
          )}

          {/* Endepunkts-håndtag på valgt væg */}
          {editableEndpoints &&
            walls
              .filter((w) => w.id === selectedWallId)
              .map((w) =>
                ([1, 2] as const).map((which) => (
                  <Circle
                    key={`ep-${w.id}-${which}`}
                    x={(which === 1 ? w.x1 : w.x2) * imgWidth}
                    y={(which === 1 ? w.y1 : w.y2) * imgHeight}
                    radius={wallWidth * 1.15}
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth={wallWidth * 0.3}
                    draggable
                    onDragMove={(e) => {
                      const p: Point = [
                        clamp01(e.target.x() / imgWidth),
                        clamp01(e.target.y() / imgHeight),
                      ];
                      onEndpointMove?.(w.id, which, p);
                    }}
                    onDragEnd={() => onEndpointRelease?.(w.id)}
                  />
                ))
              )}
        </Layer>
      </Stage>

      {/* Zoom-knapper */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={() => zoomBy(1.3)}
          className="h-9 w-9 rounded-lg bg-white text-lg shadow ring-1 ring-slate-200"
          aria-label="Zoom ind"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / 1.3)}
          className="h-9 w-9 rounded-lg bg-white text-lg shadow ring-1 ring-slate-200"
          aria-label="Zoom ud"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="h-9 w-9 rounded-lg bg-white text-sm shadow ring-1 ring-slate-200"
          aria-label="Nulstil visning"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}
