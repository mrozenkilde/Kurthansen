import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FloorPlan, Note, Profile, Room, Wall } from "@/lib/types";
import PlanViewer from "@/components/plan/PlanViewer";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ caseId: string; planId: string }>;
}) {
  const { caseId, planId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, { data: plan }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single<Profile>(),
    supabase
      .from("floor_plans")
      .select("*")
      .eq("id", planId)
      .eq("case_id", caseId)
      .single<FloorPlan>(),
  ]);

  if (!plan) notFound();

  const [{ data: rooms }, { data: wallRows }, { data: imageSigned }] =
    await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("floor_plan_id", planId)
        .returns<Room[]>(),
      supabase
        .from("walls")
        .select("*, photos(id)")
        .eq("floor_plan_id", planId)
        .returns<(Wall & { photos: { id: string }[] })[]>(),
      supabase.storage.from("floorplans").createSignedUrl(plan.image_path, 3600),
    ]);

  if (!imageSigned?.signedUrl) notFound();

  const roomIds = (rooms ?? []).map((r) => r.id);
  let notes: Note[] = [];
  if (roomIds.length > 0) {
    const { data: noteRows } = await supabase
      .from("notes")
      .select("*, profiles(full_name)")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false });
    notes = (noteRows ?? []).map((n) => ({
      ...(n as unknown as Note),
      author_name:
        (n.profiles as unknown as { full_name: string } | null)?.full_name ??
        "",
    }));
  }

  const walls: Wall[] = (wallRows ?? []).map((row) => {
    const { photos, ...wall } = row;
    void photos;
    return wall;
  });
  const photoCounts = Object.fromEntries(
    (wallRows ?? []).map((w) => [w.id, w.photos.length])
  );

  return (
    <PlanViewer
      caseId={caseId}
      plan={plan}
      imageUrl={imageSigned.signedUrl}
      rooms={rooms ?? []}
      walls={walls}
      notes={notes}
      photoCounts={photoCounts}
      isAdmin={me?.role === "admin"}
      myName={me?.full_name ?? ""}
    />
  );
}
