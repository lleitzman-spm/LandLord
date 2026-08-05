-- The court roll — the realm's first SHARED surface (Edwin, 2026-07-27).
--
-- Every identity behind the wall keeps its own isolated vault (the B2
-- sandboxes), which is what makes the beta safe and also what makes a shared
-- court impossible: one user cannot see another's realm at all. The court roll
-- is the seam that crosses that line, and it crosses it in ONE DIRECTION only.
--
-- THE LAW OF THE ROLL — one-sided transparency (Edwin's ruling): a subject may
-- submit a matter to be heard, and may see their OWN submissions and what the
-- Crown answered. Nothing on this roll is private FROM the Crown: the sovereign
-- reads every row, every submitter, every word, always. A subject can never see
-- another subject's matter, nor the docket as a whole.
--
-- The law is enforced in the WORKER, which alone holds the vault key — exactly
-- as the chronicle's per-identity routing is. RLS stays enabled with no
-- policies (publishable keys open nothing; only the secret key passes), so this
-- table is unreachable except through that door.

create table if not exists public.court_roll (
  id uuid primary key default gen_random_uuid(),
  -- Which realm's court. One realm today; the column is here so a second does
  -- not need a migration under a live beta.
  realm text not null default 'the-realm',
  -- The Access identity that submitted it, lower-cased. The Crown sees this;
  -- it is the whole point of the roll (a matter with no petitioner is a rumor).
  submitted_by text not null,
  -- What is asked, in the petitioner's own words.
  subject text not null,
  asks text not null,
  submitted_at timestamptz not null default now(),
  -- Asking to be heard LIVE while court sits (Edwin's "queue to have their
  -- requests heard live"). Null = submitted for the next court, not queued.
  queued_at timestamptz,
  -- The Crown's word. Null while the matter still stands.
  heard_at timestamptz,
  heard_by text,
  answer text
);

-- The Crown's docket: what still stands, oldest first, the queued heard first.
create index if not exists court_roll_standing_idx
  on public.court_roll (realm, heard_at, submitted_at);
-- A subject's own roll.
create index if not exists court_roll_by_petitioner_idx
  on public.court_roll (submitted_by, submitted_at desc);

alter table public.court_roll enable row level security;

-- Whether court is SITTING — the office-hours signal. One row per realm; the
-- Crown opens and closes it, every identity may read that it is open.
create table if not exists public.court_session (
  realm text primary key default 'the-realm',
  open boolean not null default false,
  opened_at timestamptz,
  opened_by text
);

alter table public.court_session enable row level security;

insert into public.court_session (realm, open)
  values ('the-realm', false)
  on conflict (realm) do nothing;
