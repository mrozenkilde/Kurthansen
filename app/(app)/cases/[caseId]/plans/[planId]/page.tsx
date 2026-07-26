import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FloorPlan, Pin, Profile } from "@/lib/types";
import PinViewer from "@/components/plan/PinViewer";

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

  const [{ data: pinRows }, { data: imageSigned }] = await Promise.all([
    supabase
      .from("pins")
      .select("*, photos(id)")
      .eq("floor_plan_id", planId)
      .order("created_at")
      .returns<(Pin & { photos: { id: string }[] })[]>(),
    supabase.storage.from("floorplans").createSignedUrl(plan.image_path, 3600),
  ]);

  if (!imageSigned?.signedUrl) notFound();

  const pins: Pin[] = (pinRows ?? []).map((row) => {
    const { photos, ...pin } = row;
    return { ...pin, photo_count: photos?.length ?? 0 };
  });

  return (
    <PinViewer
      caseId={caseId}
      plan={plan}
      imageUrl={imageSigned.signedUrl}
      initialPins={pins}
      isAdmin={me?.role === "admin"}
    />
  );
}
