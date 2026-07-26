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
  rooms: { id: string; name: string; notes: { id: string }[] }[];
  walls: {
    id: string;
    room_id: string | null;
    color_name: string | null;
    color_hex: string | null;
    status: string;
    photos: { id: string; type: string }[];
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
        .select(
          "id, name, image_path, created_at, rooms(id, name, notes(id)), walls(id, room_id, color_name, color_hex, status, photos(id, type))"
        )
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
            const wallsWithPhotos = plan.walls.filter(
              (w) => w.photos.length > 0
            ).length;
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
                      {plan.rooms.length} rum · {plan.walls.length} vægge ·{" "}
                      {wallsWithPhotos} med foto
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Link
                      href={`/cases/${caseId}/plans/${plan.id}`}
                      className="rounded-lg bg-slate-900 px-3 py-1.5 text-white"
                    >
                      Åbn
                    </Link>
                    {isAdmin && (
                      <Link
                        href={`/cases/${caseId}/plans/${plan.id}/edit`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5"
                      >
                        Redigér
                      </Link>
                    )}
                  </div>
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

      {/* Overblik pr. rum */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-medium">Overblik</h2>
        {(plans ?? []).every((p) => p.rooms.length === 0 && p.walls.length === 0) ? (
          <p className="mt-3 text-sm text-slate-500">
            Ingen rum eller vægge markeret endnu. Åbn en plantegning i
            redigering for at markere dem.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {(plans ?? []).map((plan) => (
              <div key={plan.id}>
                <h3 className="text-sm font-semibold text-slate-500">
                  {plan.name}
                </h3>
                <ul className="mt-2 divide-y divide-slate-100">
                  {plan.rooms.map((room) => {
                    const roomWalls = plan.walls.filter(
                      (w) => w.room_id === room.id
                    );
                    const withPhoto = roomWalls.filter(
                      (w) => w.photos.length > 0
                    ).length;
                    return (
                      <li
                        key={room.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                      >
                        <div>
                          <p className="font-medium">{room.name}</p>
                          <p className="text-xs text-slate-500">
                            {roomWalls.length} vægge · {withPhoto} med foto ·{" "}
                            {room.notes.length} noter
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          {roomWalls.map((w) => (
                            <span
                              key={w.id}
                              title={w.color_name ?? "Ingen farve"}
                              className="h-5 w-5 rounded-full border border-slate-300"
                              style={{
                                backgroundColor: w.color_hex ?? "#e2e8f0",
                              }}
                            />
                          ))}
                        </div>
                      </li>
                    );
                  })}
                  {plan.walls.some((w) => !w.room_id) && (
                    <li className="py-2.5 text-sm text-slate-500">
                      {plan.walls.filter((w) => !w.room_id).length} vægge uden
                      rum
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
