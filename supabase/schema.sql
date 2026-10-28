-- =====================================================================
-- Te-Un Games: database voor accounts, profielen, likes, plays, voortgang en beheer
-- Plak dit hele bestand in Supabase > SQL Editor > New query > Run.
-- Je kunt het veilig opnieuw uitvoeren.
-- =====================================================================

-- ---------- tabellen ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null default 'Kabouter',
  avatar      text not null default 'teun',      -- 'teun' of 'train'
  theme       text not null default 'smurf',     -- 'smurf' | 'ravagio' | 'sok' | 'bambi'
  is_admin    boolean not null default false,
  tour_done   boolean not null default false,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create table if not exists public.games (
  id          text primary key,                  -- korte naam in de link, bijv. te-un-surfers
  title       text not null,
  category    text not null default 'actie',
  tags        text[] not null default '{}',
  tagline     text not null default '',
  description text not null default '',
  controls    jsonb not null default '[]',
  thumb       text not null default '',
  hero        text not null default '',
  url         text not null,
  published   boolean not null default true,
  featured    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.plays (
  id         bigserial primary key,
  game_id    text not null references public.games(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists plays_game_idx on public.plays(game_id);
create index if not exists plays_time_idx on public.plays(created_at);

create table if not exists public.progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- ---------- hulpfuncties ----------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- profiel automatisch aanmaken bij een nieuwe aanmelding
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'username'), 14), ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- een gewone speler mag nooit zichzelf beheerder maken
create or replace function public.protect_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() and auth.uid() is not null then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_admin on public.profiles;
create trigger protect_admin before update on public.profiles for each row execute function public.protect_admin_flag();

-- een game-start tellen (ook voor gasten)
create or replace function public.record_play(p_game text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.games where id = p_game and published) then
    insert into public.plays (game_id, user_id) values (p_game, auth.uid());
  end if;
end;
$$;
grant execute on function public.record_play(text) to anon, authenticated;

-- cijfers per game, openbaar leesbaar (alleen aantallen)
create or replace view public.game_stats as
  select g.*,
         coalesce((select count(*) from public.plays p where p.game_id = g.id), 0) as plays,
         coalesce((select count(*) from public.likes l where l.game_id = g.id), 0) as likes
  from public.games g
  where g.published or public.is_admin();
grant select on public.game_stats to anon, authenticated;

-- ---------- beheer ----------
create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  select jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'games', (select count(*) from public.games),
    'plays', (select count(*) from public.plays),
    'likes', (select count(*) from public.likes),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'plays_per_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'count', coalesce(c.n, 0)) order by d), '[]'::jsonb)
      from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') d
      left join (select created_at::date as day, count(*) n from public.plays group by 1) c on c.day = d::date
    )
  ) into result;
  return result;
end;
$$;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_users()
returns table (id uuid, email text, username text, avatar text, theme text, is_admin boolean, created_at timestamptz, last_seen timestamptz, plays bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return query
    select p.id, u.email::text, p.username, p.avatar, p.theme, p.is_admin, p.created_at, p.last_seen,
           (select count(*) from public.plays pl where pl.user_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;
grant execute on function public.admin_users() to authenticated;

-- ---------- beveiliging (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.games    enable row level security;
alter table public.likes    enable row level security;
alter table public.plays    enable row level security;
alter table public.progress enable row level security;

drop policy if exists "profiel: eigen lezen" on public.profiles;
create policy "profiel: eigen lezen" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiel: eigen aanpassen" on public.profiles;
create policy "profiel: eigen aanpassen" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "games: gepubliceerd lezen" on public.games;
create policy "games: gepubliceerd lezen" on public.games for select using (published or public.is_admin());
drop policy if exists "games: beheerder schrijven" on public.games;
create policy "games: beheerder schrijven" on public.games for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "likes: eigen" on public.likes;
create policy "likes: eigen" on public.likes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "plays: beheerder lezen" on public.plays;
create policy "plays: beheerder lezen" on public.plays for select using (public.is_admin());

drop policy if exists "voortgang: eigen" on public.progress;
create policy "voortgang: eigen" on public.progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- eerste game ----------
insert into public.games (id, title, category, tags, tagline, description, controls, thumb, hero, url, published, featured)
values (
  'te-un-surfers', 'Te-Un Surfers', 'actie', array['arcade','avontuur'],
  'Ren over het spoor, spring op treinen en spuit treinspotters nat.',
  'Help Te-Un de kabouter ontsnappen aan de boze kabouters. Ren over drie sporen, ontwijk rijdende NS-treinen, spring via schansen op de daken en pak power-ups. Koop een rolstoel, een koe of een NS-trein om 30 seconden te vliegen en veel meer munten te verdienen.',
  '[["← →  of  A D","Een spoor opzij"],["↑  of  W","Springen"],["↓  of  S","Rollen"],["Spatie","Voertuig activeren"],["C","Ander voertuig"],["F  of dubbelklik","Waterpistool"],["Telefoon","Swipe = één spoor, dubbeltik = waterpistool"]]'::jsonb,
  '/assets/te-un-surfers.jpg', '/assets/te-un-surfers-hero.jpg', '/games/te-un-surfers/', true, true
) on conflict (id) do nothing;

-- ---------- JIJ ALS BEHEERDER ----------
-- 1. Maak eerst een account op je eigen site (te-ungames.nl).
-- 2. Vul hieronder het e-mailadres van dat account in en voer alleen dit stukje uit:
--
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'JOUW-EMAIL@VOORBEELD.NL');
