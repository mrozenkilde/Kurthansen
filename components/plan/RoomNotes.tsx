"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Note } from "@/lib/types";

export default function RoomNotes({
  roomId,
  initialNotes,
  authorName,
}: {
  roomId: string;
  initialNotes: Note[];
  authorName: string;
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function addNote() {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("notes")
      .insert({ room_id: roomId, body: text, author_id: user?.id })
      .select("*")
      .single<Note>();
    setBusy(false);
    if (!error && data) {
      setNotes((prev) => [{ ...data, author_name: authorName }, ...prev]);
      setBody("");
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv en note til rummet…"
          rows={2}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button
          onClick={addNote}
          disabled={busy || !body.trim()}
          className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Gem
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {notes.length === 0 && (
          <li className="text-sm text-slate-500">Ingen noter endnu.</li>
        )}
        {notes.map((n) => (
          <li key={n.id} className="rounded-lg bg-slate-50 p-3">
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            <p className="mt-1 text-xs text-slate-400">
              {n.author_name || "Ukendt"} ·{" "}
              {new Date(n.created_at).toLocaleString("da-DK", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
