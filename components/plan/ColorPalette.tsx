"use client";

import { useState } from "react";
import { PAINT_COLORS } from "@/lib/colors";

export default function ColorPalette({
  valueHex,
  onSelect,
}: {
  valueHex: string | null;
  onSelect: (color: { name: string; hex: string } | null) => void;
}) {
  const [customHex, setCustomHex] = useState("#aabbcc");
  const [customName, setCustomName] = useState("");

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {PAINT_COLORS.map((c) => (
          <button
            key={c.hex}
            title={c.name}
            onClick={() => onSelect(c)}
            className={`h-8 w-8 rounded-full border transition ${
              valueHex?.toLowerCase() === c.hex.toLowerCase()
                ? "border-blue-600 ring-2 ring-blue-300"
                : "border-slate-300"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
        <button
          title="Fjern farve"
          onClick={() => onSelect(null)}
          className={`h-8 w-8 rounded-full border text-xs text-slate-500 ${
            !valueHex ? "border-blue-600 ring-2 ring-blue-300" : "border-slate-300"
          }`}
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={customHex}
          onChange={(e) => setCustomHex(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-slate-300"
          title="Egen farve"
        />
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Farvenavn / NCS-kode"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
        />
        <button
          onClick={() =>
            onSelect({ name: customName.trim() || customHex, hex: customHex })
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          Brug
        </button>
      </div>
    </div>
  );
}
