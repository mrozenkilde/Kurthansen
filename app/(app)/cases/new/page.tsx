import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewCaseForm from "@/components/cases/NewCaseForm";

export const metadata = { title: "Ny sag" };

export default async function NewCasePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  if (me?.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold">Ny sag</h1>
      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <NewCaseForm />
      </div>
    </div>
  );
}
