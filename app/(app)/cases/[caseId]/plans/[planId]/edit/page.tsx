import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FloorPlan, Profile, Room, Wall } from "@/lib/types";
import PlanEditor from "@/components/plan/PlanEditor";

export default async function PlanEditPage({
  params,
}: {
  params: Promise<{ caseId: string; planId: string }>;
}) {
  const { caseId, planId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .single<Profile>();
  if (me?.role !== "admin") redirect(`/cases/${caseId}/plans/${planId}`);

  const { data: plan } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("id", planId)
    .eq("case_id", caseId)
    .single<FloorPlan>();
  if (!plan) notFound();

  const [{ data: rooms }, { data: walls }, { data: imageSigned }] =
    await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("floor_plan_id", planId)
        .returns<Room[]>(),
      supabase
        .from("walls")
        .select("*")
        .eq("floor_plan_id", planId)
        .returns<Wall[]>(),
      supabase.storage.from("floorplans").createSignedUrl(plan.image_path, 3600),
    ]);

  if (!imageSigned?.signedUrl) notFound();

  return (
    <PlanEditor
      caseId={caseId}
      plan={plan}
      imageUrl={imageSigned.signedUrl}
      initialRooms={rooms ?? []}
      initialWalls={walls ?? []}
    />
  );
}
