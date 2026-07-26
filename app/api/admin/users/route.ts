import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Opretter en ny bruger (kun for admins). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Kræver admin" }, { status: 403 });
  }

  const body = await request.json();
  const { email, password, fullName, role } = body as {
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
  };

  if (!email || !password || !fullName || !["admin", "maler"].includes(role ?? "")) {
    return NextResponse.json({ error: "Udfyld alle felter" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Adgangskoden skal være mindst 8 tegn" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id });
}
