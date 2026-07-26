-- Pins på plantegning: punkt + note + billeder (simpelt fotoregistrerings-flow)

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  floor_plan_id uuid not null references public.floor_plans (id) on delete cascade,
  x double precision not null,  -- normaliseret 0..1
  y double precision not null,
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_pins_plan on public.pins (floor_plan_id);

-- Fotos kan knyttes til en pin (væg-fotos bevares til senere)
alter table public.photos
  alter column wall_id drop not null;

alter table public.photos
  add column if not exists pin_id uuid references public.pins (id) on delete cascade;

alter table public.photos
  drop constraint if exists photos_parent_check;

alter table public.photos
  add constraint photos_parent_check
  check (
    (wall_id is not null and pin_id is null)
    or (wall_id is null and pin_id is not null)
  );

create index if not exists idx_photos_pin on public.photos (pin_id);

-- RLS
alter table public.pins enable row level security;

create or replace function public.can_access_pin(p_pin_id uuid)
returns boolean
language sql stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pins p
    where p.id = p_pin_id and public.can_access_plan(p.floor_plan_id)
  );
$$;

create policy "pins: læs med adgang" on public.pins
  for select to authenticated using (public.can_access_plan(floor_plan_id));
create policy "pins: opret med adgang" on public.pins
  for insert to authenticated
  with check (public.can_access_plan(floor_plan_id) and created_by = auth.uid());
create policy "pins: ret med adgang" on public.pins
  for update to authenticated using (public.can_access_plan(floor_plan_id));
create policy "pins: slet egne eller admin" on public.pins
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Udvid photo-policies til pins
drop policy if exists "photos: læs med adgang" on public.photos;
drop policy if exists "photos: upload med adgang" on public.photos;

create policy "photos: læs med adgang" on public.photos
  for select to authenticated using (
    (wall_id is not null and public.can_access_wall(wall_id))
    or (pin_id is not null and public.can_access_pin(pin_id))
  );

create policy "photos: upload med adgang" on public.photos
  for insert to authenticated
  with check (
    taken_by = auth.uid()
    and (
      (wall_id is not null and public.can_access_wall(wall_id))
      or (pin_id is not null and public.can_access_pin(pin_id))
    )
  );
