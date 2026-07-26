import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!hasSupabaseEnv()) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold">Opsætning mangler</h1>
          <p className="mt-3 text-slate-600">
            Supabase er ikke konfigureret endnu. Opret en fil{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code>{" "}
            med <code className="rounded bg-slate-100 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            og <code className="rounded bg-slate-100 px-1.5 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code>.
            Se README.md for den fulde vejledning.
          </p>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav profile={profile} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
