// Opret den første admin-bruger.
// Brug: node scripts/create-admin.mjs <email> <adgangskode> "<Fulde navn>"
// Kræver NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY i .env.local

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// Indlæs .env.local hvis variablerne ikke allerede er sat
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim();
  }
}

const [email, password, fullName] = process.argv.slice(2);
if (!email || !password || !fullName) {
  console.error(
    'Brug: node scripts/create-admin.mjs <email> <adgangskode> "<Fulde navn>"'
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY skal være sat (f.eks. i .env.local)"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, role: "admin" },
});

if (error) {
  console.error("Fejl:", error.message);
  process.exit(1);
}

console.log(`Admin oprettet: ${data.user.email} (${data.user.id})`);
