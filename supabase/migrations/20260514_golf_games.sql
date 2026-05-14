-- Golf games table with per-user RLS.
-- Applied to project gdegsibcmjqhxxnlzoed (Skins Scorer) on 2026-05-14.

create table if not exists public.golf_games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  course text,
  current_hole integer default 1,
  scoring_mode text default 'Stroke Play',
  players jsonb not null default '[]'::jsonb,
  holes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists golf_games_user_updated_idx
  on public.golf_games (user_id, updated_at desc);

alter table public.golf_games enable row level security;

drop policy if exists "select own games" on public.golf_games;
create policy "select own games" on public.golf_games
  for select using (auth.uid() = user_id);

drop policy if exists "insert own games" on public.golf_games;
create policy "insert own games" on public.golf_games
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own games" on public.golf_games;
create policy "update own games" on public.golf_games
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own games" on public.golf_games;
create policy "delete own games" on public.golf_games
  for delete using (auth.uid() = user_id);

create or replace function public.set_golf_games_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists golf_games_set_updated_at on public.golf_games;
create trigger golf_games_set_updated_at
  before update on public.golf_games
  for each row execute function public.set_golf_games_updated_at();
