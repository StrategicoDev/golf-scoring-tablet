-- Add share_token + settings columns on golf_games, plus a SECURITY DEFINER
-- RPC that anon callers use to fetch the latest snapshot for a single
-- share_token. Applied to project gdegsibcmjqhxxnlzoed on 2026-05-15.

alter table public.golf_games
  add column if not exists share_token uuid,
  add column if not exists settings jsonb not null default '{}'::jsonb;

create index if not exists golf_games_share_token_idx
  on public.golf_games (share_token, updated_at desc);

create or replace function public.get_leaderboard(token uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'course', g.course,
    'current_hole', g.current_hole,
    'scoring_mode', g.scoring_mode,
    'players', g.players,
    'holes', g.holes,
    'settings', g.settings,
    'updated_at', g.updated_at
  )
  from public.golf_games g
  where g.share_token = token
  order by g.updated_at desc
  limit 1;
$$;

grant execute on function public.get_leaderboard(uuid) to anon, authenticated;
