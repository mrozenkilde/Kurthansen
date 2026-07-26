"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function AppNav({ profile }: { profile: Profile }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-semibold">
          Malerfirma <span className="hidden sm:inline">Kurt Hansen</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-slate-600 hover:text-slate-900">
            Sager
          </Link>
          {profile.role === "admin" && (
            <Link
              href="/admin/users"
              className="text-slate-600 hover:text-slate-900"
            >
              Brugere
            </Link>
          )}
          <span className="hidden text-slate-400 sm:inline">
            {profile.full_name || "Bruger"}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
          >
            Log ud
          </button>
        </nav>
      </div>
    </header>
  );
}
