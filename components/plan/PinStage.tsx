"use client";

import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Circle,
  Line,
} from "react-konva";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Pin } from "@/lib/types";

interface PinStageProps {
  imageUrl: string;
  imgWidth: number;
  imgHeight: number;
  pins: Pin[];
  selectedPinId: string | null;
  onSelectPin: (id: string) => void;
  onPlacePin: (x: number, y: number) => void;
  onBackgroundTap?: () => void;
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

export default function PinStage({
  imageUrl,
  imgWidth,
  imgHeight,
  pins,
  selectedPinId,
  onSelectPin,
  onPlacePin,
  onBackgroundTap,
}: PinStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const pinchRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);
  const movedRef = useRef(false);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => setImage(img);
  }, [imageUrl]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const maxH = Math.max(360, window.innerHeight * 0.65);
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
  const pinRadius = Math.max(14, imgWidth * 0.012);

  function getNormPoint(): [number, number] | null {
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
      e.evt.preventDefault();
      if (stage.isDragging()) stage.stopDrag();
      movedRef.current = true;
      const dist = touchDistance(t1, t2);
      const center = touchCenter(t1, t2);
      if (!pinchRef.current) {
        pinchRef.current = { dist, center };
        return;
      }
      const rect = containerRef.current!.getBoundingClientRect();
      const localCenter = { x: center.x - rect.left, y: center.y - rect.top };
      zoomBy(dist / pinchRef.current.dist, localCenter);
      const dx = center.x - pinchRef.current.center.x;
      const dy = center.y - pinchRef.current.center.y;
      stage.position({ x: stage.x() + dx, y: stage.y() + dy });
      pinchRef.current = { dist, center };
    }
  }

  function handleTap() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const p = getNormPoint();
    if (!p) return;

    // Rammer man en eksisterende pin?
    const hitR = 0.025;
    let nearest: { id: string; dist: number } | null = null;
    for (const pin of pins) {
      const dist = Math.hypot(pin.x - p[0], pin.y - p[1]);
      if (!nearest || dist < nearest.dist) nearest = { id: pin.id, dist };
    }
    if (nearest && nearest.dist < hitR) {
      onSelectPin(nearest.id);
      return;
    }

    onPlacePin(p[0], p[1]);
  }

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
        draggable
        dragDistance={10}
        onWheel={handleWheel}
        onDragStart={() => {
          movedRef.current = true;
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          pinchRef.current = null;
        }}
        onClick={handleTap}
        onTap={handleTap}
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

          {pins.map((pin) => {
            const selected = pin.id === selectedPinId;
            const cx = pin.x * imgWidth;
            const cy = pin.y * imgHeight;
            const r = selected ? pinRadius * 1.25 : pinRadius;
            // Klassisk map-pin: cirkel + spids nedad
            return (
              <Line
                key={pin.id}
                points={[
                  cx,
                  cy + r * 1.8,
                  cx - r * 0.85,
                  cy + r * 0.2,
                  cx - r,
                  cy - r * 0.15,
                  cx,
                  cy - r * 1.15,
                  cx + r,
                  cy - r * 0.15,
                  cx + r * 0.85,
                  cy + r * 0.2,
                ]}
                closed
                fill={selected ? "#1d4ed8" : "#2563eb"}
                stroke="#ffffff"
                strokeWidth={r * 0.22}
                shadowColor="black"
                shadowBlur={8}
                shadowOpacity={0.35}
                shadowOffsetY={2}
                listening
                onClick={(e) => {
                  e.cancelBubble = true;
                  onSelectPin(pin.id);
                }}
                onTap={(e) => {
                  e.cancelBubble = true;
                  onSelectPin(pin.id);
                }}
              />
            );
          })}

          {/* Hvid prik i midten af valgt pin */}
          {pins
            .filter((p) => p.id === selectedPinId)
            .map((pin) => (
              <Circle
                key={`dot-${pin.id}`}
                x={pin.x * imgWidth}
                y={pin.y * imgHeight - pinRadius * 0.15}
                radius={pinRadius * 0.35}
                fill="#ffffff"
                listening={false}
              />
            ))}
        </Layer>
      </Stage>

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

      {/* Skjult callback-hook: baggrundstryk lukker sheet udefra via onBackgroundTap hvis ønsket */}
      <button type="button" className="hidden" onClick={onBackgroundTap} />
    </div>
  );
}
