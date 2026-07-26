"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCaseForm() {
  const router = useRouter();
  const [caseNumber, setCaseNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("cases")
      .insert({
        case_number: caseNumber.trim(),
        customer_name: customerName.trim(),
        address: address.trim(),
        created_by: user?.id,
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "Sagsnummeret findes allerede"
          : "Kunne ikke oprette sagen"
      );
      return;
    }
    router.replace(`/cases/${data.id}`);
    router.refresh();
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Sagsnummer</label>
        <input
          required
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          placeholder="F.eks. 2026-014"
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Kunde</label>
        <input
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Adresse</label>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputCls}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Opretter…" : "Opret sag"}
      </button>
    </form>
  );
}
