import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Case, Profile } from "@/lib/types";
import FloorPlanUpload from "@/components/cases/FloorPlanUpload";
import AssignPainters from "@/components/cases/AssignPainters";
import CaseStatusToggle from "@/components/cases/CaseStatusToggle";

interface PlanOverview {
  id: string;
  name: string;
  image_path: string;
  created_at: string;
  pins: {
    id: string;
    note: string;
    photos: { id: string }[];
  }[];
}

export default async function CasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, { data: caseRow }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase.from("cases").select("*").eq("id", caseId).single<Case>(),
  ]);

  if (!caseRow) notFound();
  const isAdmin = me?.role === "admin";

  const [{ data: plans }, { data: assignments }, { data: allProfiles }] =
    await Promise.all([
      supabase
        .from("floor_plans")
        .select("id, name, image_path, created_at, pins(id, note, photos(id))")
        .eq("case_id", caseId)
        .order("created_at")
        .returns<PlanOverview[]>(),
      supabase
        .from("case_assignments")
        .select("user_id, profiles(full_name)")
        .eq("case_id", caseId),
      isAdmin
        ? supabase.from("profiles").select("*").order("full_name").returns<Profile[]>()
        : Promise.resolve({ data: null }),
    ]);

  // Signerede thumbnails til plantegningerne
  const thumbs = new Map<string, string>();
  for (const plan of plans ?? []) {
    const { data } = await supabase.storage
      .from("floorplans")
      .createSignedUrl(plan.image_path, 3600);
    if (data?.signedUrl) thumbs.set(plan.id, data.signedUrl);
  }

  const assignedUsers = (assignments ?? []).map((a) => ({
    user_id: a.user_id as string,
    full_name:
      (a.profiles as unknown as { full_name: string } | null)?.full_name ?? "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-slate-500">
            Sag #{caseRow.case_number}
          </p>
          <h1 className="text-2xl font-semibold">{caseRow.customer_name}</h1>
          <p className="text-slate-500">{caseRow.address}</p>
        </div>
        {isAdmin ? (
          <CaseStatusToggle caseId={caseRow.id} status={caseRow.status} />
        ) : (
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              caseRow.status === "aktiv"
                ? "bg-green-100 text-green-800"
                : "bg-slate-200 text-slate-600"
            }`}
          >
            {caseRow.status === "aktiv" ? "Aktiv" : "Afsluttet"}
          </span>
        )}
      </div>

      {/* Plantegninger */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Plantegninger</h2>
        </div>

        {(plans ?? []).length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Ingen plantegninger endnu.
          </p>
        )}

        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {(plans ?? []).map((plan) => {
            const withPhotos = plan.pins.filter((p) => p.photos.length > 0)
              .length;
            return (
              <li
                key={plan.id}
                className="overflow-hidden rounded-xl border border-slate-200"
              >
                <Link href={`/cases/${caseId}/plans/${plan.id}`}>
                  {thumbs.get(plan.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbs.get(plan.id)}
                      alt={plan.name}
                      className="h-40 w-full bg-slate-50 object-contain"
                    />
                  ) : (
                    <div className="h-40 w-full bg-slate-100" />
                  )}
                </Link>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 p-3">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      {plan.pins.length} pins · {withPhotos} med foto
                    </p>
                  </div>
                  <Link
                    href={`/cases/${caseId}/plans/${plan.id}`}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
                  >
                    Åbn
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        {isAdmin && <FloorPlanUpload caseId={caseId} />}
      </section>

      {/* Malere på sagen */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-medium">Malere på sagen</h2>
        {isAdmin && allProfiles ? (
          <AssignPainters
            caseId={caseId}
            assigned={assignedUsers}
            allProfiles={allProfiles}
          />
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {assignedUsers.length === 0 && (
              <li className="text-sm text-slate-500">Ingen tildelt endnu.</li>
            )}
            {assignedUsers.map((a) => (
              <li
                key={a.user_id}
                className="rounded-full bg-slate-100 px-3 py-1 text-sm"
              >
                {a.full_name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Overblik: pins */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-medium">Registreringer</h2>
        {(plans ?? []).every((p) => p.pins.length === 0) ? (
          <p className="mt-3 text-sm text-slate-500">
            Ingen pins endnu. Åbn en plantegning og tryk for at sætte en pin med
            billede og tekst.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {(plans ?? []).map((plan) => (
              <div key={plan.id}>
                <h3 className="text-sm font-semibold text-slate-500">
                  {plan.name}
                </h3>
                <ul className="mt-2 divide-y divide-slate-100">
                  {plan.pins.map((pin, index) => (
                    <li key={pin.id} className="py-2.5">
                      <p className="font-medium">
                        Pin {index + 1}
                        {pin.photos.length > 0
                          ? ` · ${pin.photos.length} billede${pin.photos.length === 1 ? "" : "r"}`
                          : " · ingen billeder"}
                      </p>
                      <p className="text-sm text-slate-500">
                        {pin.note || "(ingen tekst)"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
