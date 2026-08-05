-- Per-identity attribution for the append-only audit trail (chronicle_history).
--
-- Beta blocker B2 gave every authenticated beta user their OWN chronicle row
-- (`chronicle:<email>`); the shared canonical `the-chronicle` stays the service
-- token's + the demo's document. But the audit table `chronicle_history` carried
-- only (seq, doc, recorded_at) — no id — so every identity's writes interleave
-- there with no way to tell whose write each row records (the KNOWN LIMIT the B2
-- migration flagged as a follow-up). This adds the identity to the trail.
--
-- Additive + reversible, and it never touches the live `chronicle` data. The
-- statement ORDER is load-bearing (K3 design review): the trigger is replaced
-- BEFORE the backfill so a write landing mid-migration already carries its id and
-- the backfill only mops up the pre-existing nulls — no row can slip through
-- unattributed. Run as ONE transaction (the Supabase migration runner wraps the
-- file), which closes the window entirely; the ordering is the belt to that
-- suspenders.
--
--   1. add a nullable `id text` column,
--   2. replace the AFTER trigger to carry `new.id` (which chronicle row was
--      written) — new writes are attributed from here on,
--   3. backfill the remaining nulls to `the-chronicle` — truthful: every write
--      recorded before this migration predates real per-identity sandboxes, so it
--      belonged to the one canonical row (any transient B2-verification test
--      insert is long cleaned up and indistinguishable, and folds harmlessly into
--      the canonical bucket — an audit-trail nicety, not the money spine),
--   4. make `id` NOT NULL so a future non-trigger insert can never silently
--      re-open the unattributed hole this migration exists to close,
--   5. index (id, seq) so a per-identity history read is ordered cheaply.

-- 1 ── the column (nullable so the backfill has something to fill)
alter table public.chronicle_history add column if not exists id text;

-- 2 ── the AFTER trigger on `chronicle` now records WHICH row the write touched.
-- Body is identical to the shipped trigger but for carrying new.id; SECURITY
-- DEFINER + empty search_path preserved exactly, insert target fully qualified.
-- CREATE OR REPLACE keeps the existing trigger binding — no re-CREATE needed.
create or replace function public.chronicle_record_history()
  returns trigger
  language plpgsql
  security definer
  set search_path to ''
as $function$
begin
  insert into public.chronicle_history (id, doc) values (new.id, new.doc);
  return null;
end;
$function$;

-- 3 ── backfill the pre-attribution era to the canonical row (see note above).
update public.chronicle_history set id = 'the-chronicle' where id is null;

-- 4 ── seal it: the trigger always supplies id, so NOT NULL costs nothing and
-- stops any future manual/restored insert from writing an unattributed row.
alter table public.chronicle_history alter column id set not null;

-- 5 ── read path: one identity's audit, in append order.
create index if not exists chronicle_history_id_seq_idx
  on public.chronicle_history (id, seq);

-- To reverse (reversible schema; the post-migration attribution data is lost when
-- the column is dropped — inherent, not a defect):
--   drop index if exists public.chronicle_history_id_seq_idx;
--   create or replace function public.chronicle_record_history()
--     returns trigger language plpgsql security definer set search_path to ''
--   as $$ begin insert into public.chronicle_history (doc) values (new.doc);
--     return null; end; $$;
--   alter table public.chronicle_history drop column if exists id;
