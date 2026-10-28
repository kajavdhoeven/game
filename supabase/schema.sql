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
-- binnenkort beschikbaar: tot 'release_at' kunnen alleen beheerders de game spelen
alter table public.games add column if not exists coming_soon boolean not null default false;
alter table public.games add column if not exists release_at timestamptz;

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

-- rechten en eigenaar (veilig opnieuw uit te voeren)
alter table public.profiles add column if not exists is_owner    boolean not null default false;
alter table public.profiles add column if not exists permissions jsonb   not null default '{}';
alter table public.games    add column if not exists logo        text    not null default '';

-- het eerst aangemelde beheerdersaccount wordt de eigenaar (alleen als er nog geen eigenaar is)
update public.profiles set is_owner = true
where id = (select id from public.profiles where is_admin order by created_at limit 1)
  and not exists (select 1 from public.profiles where is_owner);

-- ---------- hulpfuncties ----------
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- heeft de ingelogde gebruiker dit beheerdersrecht? (de eigenaar mag alles)
create or replace function public.has_perm(k text)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select p.is_owner or (p.is_admin and coalesce((p.permissions ->> k)::boolean, false))
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- mag deze speler dit doen? Ontbreekt het recht, dan mag het (standaard staat alles aan).
create or replace function public.user_can(k text)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((
    select p.is_owner or coalesce((p.permissions ->> k)::boolean, true)
    from public.profiles p where p.id = auth.uid()
  ), false);
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

-- alleen wie gebruikers mag beheren kan rol en rechten aanpassen; de eigenaar blijft altijd eigenaar
create or replace function public.protect_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.is_owner := old.is_owner;
    if not public.has_perm('manage_users') then
      new.is_admin := old.is_admin;
      new.permissions := old.permissions;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_admin on public.profiles;
create trigger protect_admin before update on public.profiles for each row execute function public.protect_admin_flag();

-- nieuwe accounts meteen als bevestigd markeren: niemand hoeft zijn e-mail te verifieren
create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  return new;
end;
$$;
drop trigger if exists auto_confirm on auth.users;
create trigger auto_confirm before insert on auth.users for each row execute function public.auto_confirm_user();

-- bestaande, nog onbevestigde accounts ook bevestigen
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- een game-start tellen (ook voor gasten)
create or replace function public.record_play(p_game text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.user_can('can_play') then return; end if;
  if exists (select 1 from public.games where id = p_game and published) then
    insert into public.plays (game_id, user_id) values (p_game, auth.uid());
  end if;
end;
$$;
grant execute on function public.record_play(text) to anon, authenticated;

-- cijfers per game, openbaar leesbaar (alleen aantallen)
drop view if exists public.game_stats;
create view public.game_stats as
  select g.*,
         coalesce((select count(*) from public.plays p where p.game_id = g.id), 0) as plays,
         coalesce((select count(*) from public.likes l where l.game_id = g.id), 0) as likes
  from public.games g
  where g.published or public.has_perm('manage_games');
grant select on public.game_stats to anon, authenticated;

-- ---------- beheer ----------
create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.has_perm('view_stats') then raise exception 'Geen toegang'; end if;
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

drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (id uuid, email text, username text, avatar text, theme text, is_admin boolean, is_owner boolean, permissions jsonb, created_at timestamptz, last_seen timestamptz, plays bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_perm('view_users') or public.has_perm('manage_users')) then raise exception 'Geen toegang'; end if;
  return query
    select p.id, u.email::text, p.username, p.avatar, p.theme, p.is_admin, p.is_owner, p.permissions, p.created_at, p.last_seen,
           (select count(*) from public.plays pl where pl.user_id = p.id)
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;
grant execute on function public.admin_users() to authenticated;

-- rol en rechten van een andere gebruiker aanpassen
create or replace function public.admin_set_user(p_user uuid, p_is_admin boolean, p_permissions jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare target public.profiles;
begin
  if not public.has_perm('manage_users') then raise exception 'Je mag geen gebruikers beheren.'; end if;
  select * into target from public.profiles where id = p_user;
  if not found then raise exception 'Gebruiker niet gevonden.'; end if;
  if target.is_owner then raise exception 'De eigenaar kan niet worden aangepast.'; end if;
  if p_user = auth.uid() then raise exception 'Je kunt je eigen rechten niet aanpassen.'; end if;
  update public.profiles set is_admin = coalesce(p_is_admin, false), permissions = coalesce(p_permissions, '{}'::jsonb) where id = p_user;
end;
$$;
grant execute on function public.admin_set_user(uuid, boolean, jsonb) to authenticated;

-- ---------- beveiliging (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.games    enable row level security;
alter table public.likes    enable row level security;
alter table public.plays    enable row level security;
alter table public.progress enable row level security;

-- eerst alle oude regels weghalen, dan opnieuw aanmaken
drop policy if exists "profiel: eigen lezen" on public.profiles;
drop policy if exists "profiel: eigen aanpassen" on public.profiles;
drop policy if exists "games: gepubliceerd lezen" on public.games;
drop policy if exists "games: beheerder schrijven" on public.games;
drop policy if exists "likes: eigen" on public.likes;
drop policy if exists "likes: lezen" on public.likes;
drop policy if exists "likes: toevoegen" on public.likes;
drop policy if exists "likes: verwijderen" on public.likes;
drop policy if exists "plays: beheerder lezen" on public.plays;
drop policy if exists "voortgang: eigen" on public.progress;
drop policy if exists "voortgang: lezen" on public.progress;
drop policy if exists "voortgang: schrijven" on public.progress;

create policy "profiel: eigen lezen" on public.profiles for select using (id = auth.uid() or public.has_perm('view_users') or public.has_perm('manage_users'));
create policy "profiel: eigen aanpassen" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "games: gepubliceerd lezen" on public.games for select using (published or public.has_perm('manage_games'));
create policy "games: beheerder schrijven" on public.games for all using (public.has_perm('manage_games')) with check (public.has_perm('manage_games'));

create policy "likes: lezen" on public.likes for select using (user_id = auth.uid());
create policy "likes: toevoegen" on public.likes for insert with check (user_id = auth.uid() and public.user_can('can_like'));
create policy "likes: verwijderen" on public.likes for delete using (user_id = auth.uid());

create policy "plays: beheerder lezen" on public.plays for select using (public.has_perm('view_stats'));

create policy "voortgang: lezen" on public.progress for select using (user_id = auth.uid());
create policy "voortgang: schrijven" on public.progress for all using (user_id = auth.uid() and public.user_can('can_save_progress')) with check (user_id = auth.uid() and public.user_can('can_save_progress'));

-- ---------- eerste game ----------
insert into public.games (id, title, category, tags, tagline, description, controls, thumb, hero, url, published, featured)
values (
  'te-un-surfers', 'Te-Un Surfers', 'actie', array['arcade','avontuur'],
  'Ren over het spoor, spring op treinen en spuit treinspotters nat.',
  'Help Te-Un de kabouter ontsnappen aan de boze kabouters. Ren over drie sporen, ontwijk rijdende NS-treinen, spring via schansen op de daken en pak power-ups. Koop een rolstoel, een koe of een NS-trein om 30 seconden te vliegen en veel meer munten te verdienen.',
  '[["← →  of  A D","Een spoor opzij"],["↑  of  W","Springen"],["↓  of  S","Rollen"],["Spatie","Voertuig activeren"],["C","Ander voertuig"],["F  of dubbelklik","Waterpistool"],["Telefoon","Swipe = één spoor, dubbeltik = waterpistool"]]'::jsonb,
  '/assets/te-un-surfers.jpg', '/assets/te-un-surfers-hero.jpg', '/games/te-un-surfers/', true, true
) on conflict (id) do nothing;

-- tweede game: Te-Un Puzzel
insert into public.games (id, title, category, tags, tagline, description, controls, thumb, hero, url, published, featured)
values (
  'te-un-puzzel', 'Te-Un Puzzel', 'puzzel', array['puzzel','kinderen'],
  'Vier legpuzzels met Te-Un, elk met een tijdslimiet.',
  'Sleep de door elkaar liggende stukjes naar de juiste plek en maak de afbeelding af. Level 1 is rustig, level 4 is serieus moeilijk: 54 stukjes die je ook nog moet draaien. Elk level heeft een tijdslimiet: 30 seconden, 1 minuut, 2,5 minuut en 10 minuten. Daarnaast is er een schuifpuzzel zonder tijdslimiet.',
  '[["Slepen","Een stukje verplaatsen, het klikt vast op zijn plek"],["Tikken","Een stukje draaien (level 4)"],["Voorbeeld","Laat de afbeelding zien"],["Randen","Maakt de middenstukjes doorzichtig, zo vind je de randen sneller"]]'::jsonb,
  '/assets/te-un-puzzel.jpg', '/assets/te-un-puzzel-hero.jpg', '/games/te-un-puzzel/', true, false
) on conflict (id) do nothing;

-- derde game: Te-Un X3M
insert into public.games (id, title, category, tags, tagline, description, controls, thumb, hero, url, published, featured)
values (
  'te-un-x3m', 'Te-Un X3M', 'racen', array['racen','actie'],
  'Spring en stunt met een fatbike, motor of gouden vape door 25 levels.',
  'Rijd door gevaarlijke levels vol lava, spijkers, zagen en vuur. Wees snel voor drie sterren, upgrade van fatbike naar motor en naar de gouden vape waarmee je vliegt, en speel nieuwe personages vrij: de oranje-shirt jongen in level 5, Te-Un Racer in level 10 en de gouden regenboog Te-Un in level 20.',
  '[["↑  of  W","Gas"],["↓  of  S","Remmen en achteruit"],["←  →  of  A D","Leunen: achterover of voorover"],["R","Level opnieuw"],["Esc  of  P","Pauze"],["Telefoon","Knoppen onderin beeld"]]'::jsonb,
  '/assets/te-un-x3m.jpg', '/assets/te-un-x3m-hero.jpg', '/games/te-un-x3m/', true, false
) on conflict (id) do nothing;

-- vierde game: Te-Un Drive
insert into public.games (id, title, category, tags, tagline, description, controls, thumb, hero, url, published, featured)
values (
  'te-un-drive', 'Te-Un Drive', 'racen', array['racen','actie'],
  'Rijd je blokkenauto door 25 levels vol bruggen, gaten en spijkers.',
  'Rijd je blokkenauto over heuvels, trappen, houten bruggen en gaten vol water naar de finish. Pas op voor spijkers! Speel nieuwe auto''s vrij: vanaf level 5 Hermano''s fiets, vanaf level 15 de gouden regenboogauto en vanaf level 20 de tuinkabouterauto.',
  '[["→  of  D","Gas"],["←  of  A","Remmen en achteruit"],["R","Level opnieuw"],["Esc  of  P","Pauze"],["In de lucht","Gas tilt de neus op, rem duwt hem omlaag"],["Telefoon","Knoppen onderin beeld"]]'::jsonb,
  '/assets/te-un-drive.jpg', '/assets/te-un-drive-hero.jpg', '/games/te-un-drive/', true, false
) on conflict (id) do nothing;

-- teksten van de nieuwere games bijwerken (veilig om vaker te draaien)
update public.games set
  tagline = 'Vier legpuzzels en vier schuifpuzzels met Te-Un.',
  description = 'Sleep de door elkaar liggende stukjes naar de juiste plek en maak de afbeelding af. Level 1 is rustig, level 4 is serieus moeilijk: 54 stukjes die je ook nog moet draaien. Elk level heeft een tijdslimiet: 30 seconden, 1 minuut, 2,5 minuut en 10 minuten. Daarnaast is er een schuifpuzzel zonder tijdslimiet.'
where id = 'te-un-puzzel';
update public.games set
  description = 'Rijd door gevaarlijke levels vol lava, spijkers, zagen en vuur. Wees snel voor drie sterren, upgrade van fatbike naar motor en naar de gouden vape waarmee je vliegt, en speel nieuwe personages vrij: de oranje-shirt jongen in level 5, Te-Un Racer in level 10 en de gouden regenboog Te-Un in level 20.'
where id = 'te-un-x3m';

update public.games set logo = '/assets/te-un-x3m-logo.png' where id = 'te-un-x3m' and coalesce(logo, '') = '';
update public.games set logo = '/assets/te-un-drive-logo.png' where id = 'te-un-drive' and coalesce(logo, '') = '';
-- titel-logo voor de eerste game
update public.games set logo = '/assets/te-un-surfers-logo.png' where id = 'te-un-surfers' and coalesce(logo, '') = '';
update public.games set logo = '/assets/te-un-puzzel-logo.png' where id = 'te-un-puzzel' and coalesce(logo, '') = '';

-- ---------- JIJ ALS EIGENAAR ----------
-- 1. Maak eerst een account op je eigen site (te-ungames.nl).
-- 2. Vul hieronder het e-mailadres van dat account in en voer alleen deze regels uit.
--    De eigenaar heeft altijd alle rechten en kan daarna anderen beheerder maken via het dashboard.
--
-- update public.profiles set is_admin = true, is_owner = true
--   where id = (select id from auth.users where email = 'JOUW-EMAIL@VOORBEELD.NL');
