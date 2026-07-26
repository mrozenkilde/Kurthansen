import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Case, Profile } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: cases }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Case[]>(),
  ]);

  const isAdmin = profile?.role === "admin";

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sager</h1>
        {isAdmin && (
          <Link
            href="/cases/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            + Ny sag
          </Link>
        )}
      </div>

      {!cases || cases.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
          {isAdmin
            ? "Ingen sager endnu. Opret den første med “Ny sag”."
            : "Du er ikke tildelt nogen sager endnu."}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/cases/${c.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm transition hover:shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm text-slate-500">
                    #{c.case_number}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status === "aktiv"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {c.status === "aktiv" ? "Aktiv" : "Afsluttet"}
                  </span>
                </div>
                <p className="mt-2 font-medium">{c.customer_name}</p>
                <p className="text-sm text-slate-500">{c.address}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
