"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function AssignPainters({
  caseId,
  assigned,
  allProfiles,
}: {
  caseId: string;
  assigned: { user_id: string; full_name: string }[];
  allProfiles: Profile[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  const unassigned = allProfiles.filter(
    (p) => !assigned.some((a) => a.user_id === p.id)
  );

  async function add() {
    if (!selected) return;
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("case_assignments")
      .insert({ case_id: caseId, user_id: selected });
    setBusy(false);
    setSelected("");
    router.refresh();
  }

  async function remove(userId: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("case_assignments")
      .delete()
      .eq("case_id", caseId)
      .eq("user_id", userId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-3">
      <ul className="flex flex-wrap gap-2">
        {assigned.length === 0 && (
          <li className="text-sm text-slate-500">Ingen tildelt endnu.</li>
        )}
        {assigned.map((a) => (
          <li
            key={a.user_id}
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm"
          >
            {a.full_name}
            <button
              onClick={() => remove(a.user_id)}
              disabled={busy}
              className="text-slate-400 hover:text-red-600"
              title="Fjern fra sagen"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {unassigned.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
          >
            <option value="">Vælg bruger…</option>
            {unassigned.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || "(uden navn)"}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={!selected || busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Tilføj
          </button>
        </div>
      )}
    </div>
  );
}
