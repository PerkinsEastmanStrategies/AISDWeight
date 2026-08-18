-- ESA scoring review — Supabase schema
-- Matches the v3 submit payload: one submission + one row per session weight.
-- Paste into the Supabase SQL editor (or run via supabase db).

create extension if not exists "pgcrypto";

do $$ begin
  create type public.school_level as enum ('ES', 'MS', 'HS');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.weight_layer as enum (
    'focus_area',
    'space_type',
    'category',
    'subcategory'
  );
exception when duplicate_object then null;
end $$;

-- One row each time a reviewer hits Submit
create table if not exists public.weighting_submissions (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  reviewer_name text,
  contact text,
  school_level public.school_level not null,
  submitted_at timestamptz not null default now(),
  hierarchy_generated_at timestamptz,
  payload_version smallint not null default 3,
  -- Optional: keep the full JSON blob as a backup of the submit
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists weighting_submissions_company_idx
  on public.weighting_submissions (lower(company), school_level, submitted_at desc);

-- One row per weighted item in that submission
create table if not exists public.weighting_items (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.weighting_submissions (id)
    on delete cascade,
  layer public.weight_layer not null,
  item_key text not null,          -- app key, e.g. ES||fa||Visual Arts
  item_label text not null,        -- display name
  weight integer not null check (weight > 0),
  comment text,
  include_in_score boolean not null default true,
  -- Convenience columns parsed from keys (nullable when not applicable)
  focus_area text,
  space_type_id text,
  category text,
  subcategory text,
  unique (submission_id, layer, item_key)
);

create index if not exists weighting_items_submission_idx
  on public.weighting_items (submission_id, layer);

create index if not exists weighting_items_layer_label_idx
  on public.weighting_items (layer, item_label);

-- Latest submission per company + school level
create or replace view public.weighting_submissions_latest as
select distinct on (lower(company), school_level)
  *
from public.weighting_submissions
order by lower(company), school_level, submitted_at desc;

comment on table public.weighting_submissions is
  'One ESA weighting review submit (company + school level). New submit = new row (history kept).';
comment on table public.weighting_items is
  'Session weights from a submit: focus areas, space types, categories, subcategories.';
comment on column public.weighting_items.item_key is
  'Stable key from the app. Focus area: {ES|MS|HS}||fa||{name}. Space type: {level}::{slug}. Category: {spaceTypeId}||cat||{category}. Subcategory: {spaceTypeId}||sub||{category}||{subcategory}.';

alter table public.weighting_submissions enable row level security;
alter table public.weighting_items enable row level security;

-- Tighten these before going live.
-- For a first wiring from the browser with the anon key, allow insert+select.
drop policy if exists weighting_submissions_insert_anon on public.weighting_submissions;
create policy weighting_submissions_insert_anon
  on public.weighting_submissions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists weighting_submissions_select_anon on public.weighting_submissions;
create policy weighting_submissions_select_anon
  on public.weighting_submissions
  for select
  to anon, authenticated
  using (true);

drop policy if exists weighting_items_insert_anon on public.weighting_items;
create policy weighting_items_insert_anon
  on public.weighting_items
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists weighting_items_select_anon on public.weighting_items;
create policy weighting_items_select_anon
  on public.weighting_items
  for select
  to anon, authenticated
  using (true);

alter table public.weighting_submissions
  add column if not exists reviewer_name text;
