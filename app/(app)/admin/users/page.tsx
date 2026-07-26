import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import NewUserForm from "@/components/admin/NewUserForm";

export const metadata = { title: "Brugere" };

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();
  if (me?.role !== "admin") redirect("/");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")
    .returns<Profile[]>();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Brugere</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-medium">Alle brugere</h2>
          <ul className="mt-4 divide-y divide-slate-100">
            {(profiles ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span>{p.full_name || "(uden navn)"}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    p.role === "admin"
                      ? "bg-indigo-100 text-indigo-800"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {p.role === "admin" ? "Kontor/admin" : "Maler"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-medium">Opret ny bruger</h2>
          <NewUserForm />
        </div>
      </div>
    </div>
  );
}
