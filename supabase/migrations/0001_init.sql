-- Malerfirma sagssystem: initielt skema
-- Køres i Supabase SQL editor eller via `supabase db push`

create extension if not exists "pgcrypto";

-- ============ Enums ============
create type public.user_role as enum ('admin', 'maler');
create type public.case_status as enum ('aktiv', 'afsluttet');
create type public.wall_status as enum ('ikke_paabegyndt', 'i_gang', 'klar_til_ks', 'godkendt');
create type public.photo_type as enum ('dokumentation', 'kvalitetssikring');

-- ============ Tabeller ============

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role public.user_role not null default 'maler',
  created_at timestamptz not null default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  customer_name text not null,
  address text not null default '',
  status public.case_status not null default 'aktiv',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.case_assignments (
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, user_id)
);

create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  name text not null,
  image_path text not null,      -- renderet PNG/JPG i bucket 'floorplans'
  original_path text,            -- evt. original PDF
  width integer not null,        -- pixelbredde af renderet billede
  height integer not null,
  created_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,
  name text not null,
  polygon jsonb not null default '[]'::jsonb,  -- [[x,y], ...] normaliseret 0..1
  created_at timestamptz not null default now()
);

create table public.walls (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  x1 double precision not null,  -- normaliseret 0..1 relativt til tegningen
  y1 double precision not null,
  x2 double precision not null,
  y2 double precision not null,
  color_name text,
  color_hex text,
  status public.wall_status not null default 'ikke_paabegyndt',
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references public.walls (id) on delete cascade,
  type public.photo_type not null default 'dokumentation',
  storage_path text not null,    -- sti i bucket 'photos'
  taken_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_floor_plans_case on public.floor_plans (case_id);
create index idx_rooms_plan on public.rooms (floor_plan_id);
create index idx_walls_plan on public.walls (floor_plan_id);
create index idx_walls_room on public.walls (room_id);
create index idx_photos_wall on public.photos (wall_id);
create index idx_notes_room on public.notes (room_id);

-- ============ Automatisk profil ved ny bruger ============

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'maler')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Hjælpefunktioner til RLS ============

create or replace function public.is_admin()
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_assigned_to_case(p_case_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_assignments
    where case_id = p_case_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_case(p_case_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_assigned_to_case(p_case_id);
$$;

create or replace function public.can_access_plan(p_plan_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.floor_plans fp
    where fp.id = p_plan_id and public.can_access_case(fp.case_id)
  );
$$;

create or replace function public.can_access_room(p_room_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and public.can_access_plan(r.floor_plan_id)
  );
$$;

create or replace function public.can_access_wall(p_wall_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.walls w
    where w.id = p_wall_id and public.can_access_plan(w.floor_plan_id)
  );
$$;

-- ============ Row Level Security ============

alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_assignments enable row level security;
alter table public.floor_plans enable row level security;
alter table public.rooms enable row level security;
alter table public.walls enable row level security;
alter table public.photos enable row level security;
alter table public.notes enable row level security;

-- profiles
create policy "profiles: læs for alle loggede ind" on public.profiles
  for select to authenticated using (true);
create policy "profiles: ret egen eller som admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());

-- cases
create policy "cases: læs tildelte eller som admin" on public.cases
  for select to authenticated using (public.can_access_case(id));
create policy "cases: opret som admin" on public.cases
  for insert to authenticated with check (public.is_admin());
create policy "cases: ret som admin" on public.cases
  for update to authenticated using (public.is_admin());
create policy "cases: slet som admin" on public.cases
  for delete to authenticated using (public.is_admin());

-- case_assignments
create policy "assignments: læs egne eller som admin" on public.case_assignments
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "assignments: opret som admin" on public.case_assignments
  for insert to authenticated with check (public.is_admin());
create policy "assignments: slet som admin" on public.case_assignments
  for delete to authenticated using (public.is_admin());

-- floor_plans
create policy "plans: læs med sagsadgang" on public.floor_plans
  for select to authenticated using (public.can_access_case(case_id));
create policy "plans: opret som admin" on public.floor_plans
  for insert to authenticated with check (public.is_admin());
create policy "plans: ret som admin" on public.floor_plans
  for update to authenticated using (public.is_admin());
create policy "plans: slet som admin" on public.floor_plans
  for delete to authenticated using (public.is_admin());

-- rooms
create policy "rooms: læs med adgang" on public.rooms
  for select to authenticated using (public.can_access_plan(floor_plan_id));
create policy "rooms: opret som admin" on public.rooms
  for insert to authenticated with check (public.is_admin());
create policy "rooms: ret som admin" on public.rooms
  for update to authenticated using (public.is_admin());
create policy "rooms: slet som admin" on public.rooms
  for delete to authenticated using (public.is_admin());

-- walls
create policy "walls: læs med adgang" on public.walls
  for select to authenticated using (public.can_access_plan(floor_plan_id));
create policy "walls: opret som admin" on public.walls
  for insert to authenticated with check (public.is_admin());
create policy "walls: ret som admin" on public.walls
  for update to authenticated using (public.is_admin());
create policy "walls: slet som admin" on public.walls
  for delete to authenticated using (public.is_admin());

-- photos
create policy "photos: læs med adgang" on public.photos
  for select to authenticated using (public.can_access_wall(wall_id));
create policy "photos: upload med adgang" on public.photos
  for insert to authenticated
  with check (public.can_access_wall(wall_id) and taken_by = auth.uid());
create policy "photos: slet egne eller som admin" on public.photos
  for delete to authenticated using (taken_by = auth.uid() or public.is_admin());

-- notes
create policy "notes: læs med adgang" on public.notes
  for select to authenticated using (public.can_access_room(room_id));
create policy "notes: opret med adgang" on public.notes
  for insert to authenticated
  with check (public.can_access_room(room_id) and author_id = auth.uid());
create policy "notes: ret egne" on public.notes
  for update to authenticated using (author_id = auth.uid() or public.is_admin());
create policy "notes: slet egne eller som admin" on public.notes
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- ============ Storage buckets ============

insert into storage.buckets (id, name, public)
values ('floorplans', 'floorplans', false), ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "storage floorplans: læs for loggede ind" on storage.objects
  for select to authenticated using (bucket_id = 'floorplans');
create policy "storage floorplans: upload som admin" on storage.objects
  for insert to authenticated with check (bucket_id = 'floorplans' and public.is_admin());
create policy "storage floorplans: slet som admin" on storage.objects
  for delete to authenticated using (bucket_id = 'floorplans' and public.is_admin());

create policy "storage photos: læs for loggede ind" on storage.objects
  for select to authenticated using (bucket_id = 'photos');
create policy "storage photos: upload for loggede ind" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');
create policy "storage photos: slet egne eller som admin" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and (owner = auth.uid() or public.is_admin()));
