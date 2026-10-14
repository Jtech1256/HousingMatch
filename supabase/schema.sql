-- =====================================================================
-- RoomieMatch database
-- Paste this whole file into Supabase: Dashboard -> SQL Editor -> New query -> Run
-- It is safe to run on a brand-new project. (To start over, see README.)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PROFILES  — one row per student
-- ---------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  school_domain         text not null,             -- e.g. 'vt.edu' (filled in automatically)
  name                  text not null check (char_length(name) between 1 and 50),
  photo_url             text,
  bio                   text not null default '' check (char_length(bio) <= 500),
  major                 text not null default '',
  grad_year             int  check (grad_year between 2020 and 2040),
  gender                text not null check (gender in ('man', 'woman', 'nonbinary')),
  roommate_gender_pref  text not null default 'any' check (roommate_gender_pref in ('same', 'any')),
  housing_type          text not null check (housing_type in ('on_campus', 'off_campus', 'either')),
  preferred_areas       text[] not null default '{}',   -- dorms / complexes / neighborhoods
  budget_min            int  not null check (budget_min >= 0),
  budget_max            int  not null,
  move_in               date not null,
  interests             text[] not null default '{}',
  quiz                  smallint[],                    -- 8 answers, each 1-5 (null = quiz not done yet)
  created_at            timestamptz not null default now(),
  check (budget_max >= budget_min),
  check (quiz is null or (cardinality(quiz) = 8 and 1 <= all (quiz) and 5 >= all (quiz)))
);

-- Only real school emails can make a profile, and we record which school.
-- This runs on the server, so nobody can skip it by editing the app.
create function public.set_school_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
begin
  select email into user_email from auth.users where id = new.id;
  if user_email is null or lower(user_email) not like '%.edu' then
    raise exception 'A .edu email address is required';
  end if;
  new.school_domain := lower(split_part(user_email, '@', 2));
  return new;
end;
$$;

create trigger profiles_set_school_domain
  before insert or update of school_domain on public.profiles
  for each row execute function public.set_school_domain();


-- ---------------------------------------------------------------------
-- 2. SWIPES  — every left/right swipe
-- ---------------------------------------------------------------------
create table public.swipes (
  swiper     uuid not null references public.profiles (id) on delete cascade,
  swipee     uuid not null references public.profiles (id) on delete cascade,
  liked      boolean not null,
  created_at timestamptz not null default now(),
  primary key (swiper, swipee),
  check (swiper <> swipee)
);


-- ---------------------------------------------------------------------
-- 3. MATCHES  — created automatically when two people like each other
-- ---------------------------------------------------------------------
create table public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)          -- store each pair only once
);

create function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.liked and exists (
    select 1 from swipes
    where swiper = new.swipee and swipee = new.swiper and liked
  ) then
    insert into matches (user_a, user_b)
    values (least(new.swiper, new.swipee), greatest(new.swiper, new.swipee))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger swipes_create_match
  after insert on public.swipes
  for each row execute function public.create_match_on_mutual_like();


-- ---------------------------------------------------------------------
-- 4. MESSAGES  — chat inside a match
-- ---------------------------------------------------------------------
create table public.messages (
  id         bigint generated always as identity primary key,
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_match_id_idx on public.messages (match_id, created_at);


-- ---------------------------------------------------------------------
-- 5. SAFETY  — blocks and reports
-- ---------------------------------------------------------------------
create table public.blocks (
  blocker    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.reports (
  id         bigint generated always as identity primary key,
  reporter   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reported   uuid not null references public.profiles (id) on delete cascade,
  reason     text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- True if either person blocked the other
create function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- Blocking someone also removes your match (and its chat) with them
create function public.remove_match_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from matches
  where user_a = least(new.blocker, new.blocked)
    and user_b = greatest(new.blocker, new.blocked);
  return new;
end;
$$;

create trigger blocks_remove_match
  after insert on public.blocks
  for each row execute function public.remove_match_on_block();


-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY  — who can read / write what
--    (The app's key is public, so these rules are what protect the data.)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.swipes   enable row level security;
alter table public.matches  enable row level security;
alter table public.messages enable row level security;
alter table public.blocks   enable row level security;
alter table public.reports  enable row level security;

-- Profiles: signed-in students can see profiles at their own school,
-- except people they've blocked or who blocked them. Edit only your own.
create function public.my_school()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select school_domain from profiles where id = auth.uid();
$$;

create policy "see same-school profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or (school_domain = public.my_school() and not public.is_blocked(auth.uid(), id)));
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Swipes: you can record and see only your own swipes
create policy "insert own swipes" on public.swipes
  for insert to authenticated with check (swiper = auth.uid());
create policy "see own swipes" on public.swipes
  for select to authenticated using (swiper = auth.uid());

-- Matches: see and unmatch only your own (matches are created by the trigger)
create policy "see own matches" on public.matches
  for select to authenticated using (auth.uid() in (user_a, user_b));
create policy "unmatch" on public.matches
  for delete to authenticated using (auth.uid() in (user_a, user_b));

-- Messages: read and send only inside your own matches
create policy "read messages in my matches" on public.messages
  for select to authenticated
  using (exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b)));
create policy "send messages in my matches" on public.messages
  for insert to authenticated
  with check (
    sender = auth.uid()
    and exists (select 1 from matches m where m.id = match_id and auth.uid() in (m.user_a, m.user_b))
  );

-- Blocks and reports: write your own; reports are only readable from the dashboard
create policy "block someone" on public.blocks
  for insert to authenticated with check (blocker = auth.uid());
create policy "see who I blocked" on public.blocks
  for select to authenticated using (blocker = auth.uid());
create policy "report someone" on public.reports
  for insert to authenticated with check (reporter = auth.uid());


-- ---------------------------------------------------------------------
-- 7. MATCHING  — the swipe deck
--    Step 1: hard filters (school, housing, budget, dates, area, gender pref)
--    Step 2: score 0-100 from the lifestyle quiz, plus small bonuses
-- ---------------------------------------------------------------------
create function public.get_candidates(max_results int default 20)
returns table (
  id               uuid,
  name             text,
  photo_url        text,
  bio              text,
  major            text,
  grad_year        int,
  housing_type     text,
  preferred_areas  text[],
  budget_min       int,
  budget_max       int,
  move_in          date,
  interests        text[],
  score            int,
  shared_interests text[],
  shared_areas     text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select * from profiles where profiles.id = auth.uid()
  ),
  candidates as (
    select
      p.*,
      -- Quiz similarity: answers are 1-5, so the biggest gap per question is 4.
      -- 0 average gap -> 100 points, 4 average gap -> 0 points.
      (
        select 100 - round(avg(abs(a.v - b.v)) * 25)
        from unnest(me.quiz) with ordinality as a(v, i)
        join unnest(p.quiz) with ordinality as b(v, i) using (i)
      )::int as quiz_score,
      array(select x from unnest(p.interests) x where x = any (me.interests)) as shared_i,
      array(select x from unnest(p.preferred_areas) x where x = any (me.preferred_areas)) as shared_a
    from profiles p, me
    where p.id <> me.id
      and p.quiz is not null
      and me.quiz is not null
      and p.school_domain = me.school_domain
      -- housing type is compatible
      and (me.housing_type = 'either' or p.housing_type = 'either' or me.housing_type = p.housing_type)
      -- budget ranges overlap
      and p.budget_min <= me.budget_max and p.budget_max >= me.budget_min
      -- move-in dates within ~6 weeks of each other
      and abs(p.move_in - me.move_in) <= 45
      -- if both picked specific places, they share at least one
      and (cardinality(me.preferred_areas) = 0 or cardinality(p.preferred_areas) = 0
           or me.preferred_areas && p.preferred_areas)
      -- gender preference has to work for both people
      and (me.roommate_gender_pref = 'any' or p.gender = me.gender)
      and (p.roommate_gender_pref = 'any' or p.gender = me.gender)
      -- haven't already swiped on them, and nobody is blocked
      and not exists (select 1 from swipes s where s.swiper = me.id and s.swipee = p.id)
      and not public.is_blocked(me.id, p.id)
  )
  select
    c.id, c.name, c.photo_url, c.bio, c.major, c.grad_year, c.housing_type,
    c.preferred_areas, c.budget_min, c.budget_max, c.move_in, c.interests,
    least(100, c.quiz_score
               + 2 * cardinality(c.shared_i)                         -- +2 per shared interest
               + case when cardinality(c.shared_a) > 0 then 5 else 0 end  -- +5 same place
         )::int as score,
    c.shared_i,
    c.shared_a
  from candidates c
  order by score desc, c.created_at desc
  limit max_results;
$$;


-- ---------------------------------------------------------------------
-- 8. PROFILE PHOTOS  — storage bucket; each user writes only to their own folder
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------
-- 9. REALTIME  — new matches and chat messages show up instantly
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.matches;
