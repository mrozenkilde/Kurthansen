"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CaseStatus } from "@/lib/types";

export default function CaseStatusToggle({
  caseId,
  status,
}: {
  caseId: string;
  status: CaseStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    await supabase
      .from("cases")
      .update({ status: status === "aktiv" ? "afsluttet" : "aktiv" })
      .eq("id", caseId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`rounded-full px-3 py-1 text-sm font-medium transition disabled:opacity-50 ${
        status === "aktiv"
          ? "bg-green-100 text-green-800 hover:bg-green-200"
          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
      }`}
      title="Skift status"
    >
      {status === "aktiv" ? "Aktiv" : "Afsluttet"} ⇄
    </button>
  );
}
