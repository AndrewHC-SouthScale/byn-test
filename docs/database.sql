-- ============================================================
-- BYN — Bet Your Nuts
-- Database Schema v1
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Profiles ─────────────────────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  email text,
  country text,
  date_of_birth date,
  age_verified_at timestamptz,
  extra_league_slots int not null default 0,
  favourite_team_by_comp jsonb default '{}'::jsonb,
  referral_code text unique,
  created_at timestamptz default now()
);

-- ── Sport categories ─────────────────────────────────────────
create table public.sport_categories (
  id serial primary key,
  key text unique not null,
  name text not null
);

insert into public.sport_categories (key, name) values
  ('football', 'Football'),
  ('rugby', 'Rugby'),
  ('basketball', 'Basketball'),
  ('tennis', 'Tennis'),
  ('american_football', 'American Football'),
  ('cricket', 'Cricket'),
  ('motorsport', 'Motorsport'),
  ('golf', 'Golf');

-- ── Competitions ─────────────────────────────────────────────
create table public.competitions (
  id serial primary key,
  category_id int references public.sport_categories(id),
  key text unique not null,
  name text not null,
  cadence text not null, -- 'weekly' or 'per_event'
  is_special_event boolean default false,
  active_window_start timestamptz,
  active_window_end timestamptz,
  base_liquidity numeric default 250,
  created_at timestamptz default now()
);

insert into public.competitions (category_id, key, name, cadence, is_special_event, base_liquidity) values
  (1, 'epl', 'EPL', 'weekly', false, 400),
  (1, 'ucl', 'Champions League', 'weekly', false, 380),
  (1, 'fifa_wc', 'World Cup', 'per_event', true, 450),
  (1, 'euros', 'Euros', 'per_event', true, 420),
  (2, 'six_nations', 'Six Nations', 'per_event', true, 150),
  (2, 'rugby_wc', 'Rugby World Cup', 'per_event', true, 180),
  (2, 'prem_rugby', 'Premiership Rugby', 'weekly', false, 100),
  (3, 'nba', 'NBA', 'weekly', false, 350),
  (4, 'atp', 'ATP Tour', 'weekly', false, 250),
  (4, 'wta', 'WTA Tour', 'weekly', false, 220),
  (5, 'nfl', 'NFL', 'weekly', false, 380),
  (6, 'ipl', 'IPL', 'weekly', false, 150),
  (7, 'f1', 'F1', 'per_event', false, 280),
  (7, 'motogp', 'MotoGP', 'per_event', false, 220),
  (7, 'nascar', 'NASCAR', 'per_event', false, 180),
  (8, 'pga', 'PGA Tour', 'per_event', false, 200);

-- ── Wallets ──────────────────────────────────────────────────
create table public.wallets (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  competition_id int references public.competitions(id),
  balance numeric not null default 0,
  updated_at timestamptz default now(),
  unique(user_id, competition_id)
);

-- ── Betting rounds ───────────────────────────────────────────
create table public.betting_rounds (
  id serial primary key,
  competition_id int references public.competitions(id),
  label text not null,
  round_number int not null,
  season_number int not null default 1,
  opens_at timestamptz,
  lockout_at timestamptz,
  status text not null default 'upcoming', -- upcoming/open/locked/settled
  created_at timestamptz default now()
);

-- ── Events (fixtures/races/tournaments) ──────────────────────
create table public.events (
  id serial primary key,
  round_id int references public.betting_rounds(id),
  competition_id int references public.competitions(id),
  name text not null,
  starts_at timestamptz,
  status text not null default 'scheduled', -- scheduled/live/finished/postponed/cancelled
  external_id text,
  created_at timestamptz default now()
);

-- ── Markets ──────────────────────────────────────────────────
create table public.markets (
  id serial primary key,
  event_id int references public.events(id),
  market_type text not null default 'winner',
  liquidity_b numeric not null default 250,
  status text not null default 'open', -- open/locked/settled
  created_at timestamptz default now()
);

-- ── Market outcomes ──────────────────────────────────────────
create table public.market_outcomes (
  id serial primary key,
  market_id int references public.markets(id),
  label text not null,
  q numeric not null default 0,
  is_winner boolean,
  sort_order int default 0
);

-- ── Bets ─────────────────────────────────────────────────────
create table public.bets (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  market_outcome_id int references public.market_outcomes(id),
  round_id int references public.betting_rounds(id),
  competition_id int references public.competitions(id),
  stake numeric not null,
  shares numeric not null,
  price_at_execution numeric not null,
  void boolean default false,
  settled boolean default false,
  payout numeric,
  created_at timestamptz default now()
);

-- ── Round standings (snapshot after each round settles) ──────
create table public.round_standings (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  competition_id int references public.competitions(id),
  round_id int references public.betting_rounds(id),
  round_number int not null,
  season_number int not null,
  ending_balance numeric not null,
  rank int,
  created_at timestamptz default now(),
  unique(user_id, round_id)
);

-- ── Groups (private leagues) ──────────────────────────────────
create table public.groups (
  id serial primary key,
  name text not null,
  creator_id uuid references public.profiles(id),
  invite_code text unique not null,
  status text not null default 'pending', -- pending/approved/rejected
  max_members int not null default 100,
  sponsor_org_id int,
  is_sponsored boolean default false,
  created_at timestamptz default now()
);

-- ── Group members ─────────────────────────────────────────────
create table public.group_members (
  group_id int references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

-- ── Ad views ─────────────────────────────────────────────────
create table public.ad_views (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  competition_id int references public.competitions(id),
  round_id int references public.betting_rounds(id),
  nuts_earned int not null default 50,
  ad_provider_ref text,
  viewed_at timestamptz default now()
);

-- ── Referrals ─────────────────────────────────────────────────
create table public.referrals (
  id serial primary key,
  referrer_id uuid references public.profiles(id),
  referee_id uuid references public.profiles(id),
  referrer_comp_id int references public.competitions(id),
  referee_comp_id int references public.competitions(id),
  bonus_amount int not null default 500,
  created_at timestamptz default now()
);

-- ── Purchases ─────────────────────────────────────────────────
create table public.purchases (
  id serial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  product text not null, -- 'league_slot_pack_3', 'sponsored_league_creation'
  slots_granted int,
  amount_paid numeric,
  currency text default 'GBP',
  payment_provider_ref text,
  status text not null default 'pending', -- pending/completed/refunded
  created_at timestamptz default now()
);

-- ── Sponsor slots ─────────────────────────────────────────────
create table public.sponsor_slots (
  id serial primary key,
  placement text not null, -- 'global_top_banner', 'fixture_list_native', 'league_leaderboard'
  group_id int references public.groups(id),
  sponsor_name text,
  creative_url text,
  click_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

-- ── Row level security (RLS) ──────────────────────────────────
-- Enable RLS on all user-facing tables
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.bets enable row level security;
alter table public.group_members enable row level security;
alter table public.ad_views enable row level security;
alter table public.referrals enable row level security;
alter table public.purchases enable row level security;

-- Profiles: users can read all profiles but only update their own
create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Wallets: users can only see and update their own
create policy "Users can view own wallets"
  on public.wallets for select using (auth.uid() = user_id);
create policy "Users can update own wallets"
  on public.wallets for update using (auth.uid() = user_id);

-- Bets: users can only see their own bets
create policy "Users can view own bets"
  on public.bets for select using (auth.uid() = user_id);
create policy "Users can insert own bets"
  on public.bets for insert with check (auth.uid() = user_id);

-- Group members: visible to all (for leaderboard scoping)
create policy "Group members are viewable by everyone"
  on public.group_members for select using (true);
create policy "Users can join groups"
  on public.group_members for insert with check (auth.uid() = user_id);

-- Ad views: users can only see their own
create policy "Users can view own ad views"
  on public.ad_views for select using (auth.uid() = user_id);
create policy "Users can insert own ad views"
  on public.ad_views for insert with check (auth.uid() = user_id);
