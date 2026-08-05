-- Per-identity chronicle sandboxes (beta blocker B2).
--
-- The vault's `chronicle` table was pinned to a single row by a CHECK
-- constraint (`id = 'the-chronicle'`). Every beta user therefore shared ONE
-- document — one person's test muster was everyone's reality. Behind the
-- Cloudflare Access wall each authenticated user carries an email, and the
-- worker now routes them to their OWN row (`chronicle:<email>`), bootstrapping
-- founding on first write. The shared canonical row `the-chronicle` stays the
-- service token's + the demo's document, untouched.
--
-- This migration only RELAXES what ids are allowed. The existing row and its
-- data are untouched, and it is fully reversible (re-add the CHECK). The
-- primary key still guarantees one row per id.
--
-- KNOWN LIMIT (follow-up, not blocking): `chronicle_history` has no id column,
-- so its append-only audit interleaves all identities' writes. Distinguishing
-- them cleanly would add an id column + touch the AFTER trigger — deferred.

ALTER TABLE public.chronicle DROP CONSTRAINT IF EXISTS chronicle_id_check;

-- To reverse:
--   ALTER TABLE public.chronicle
--     ADD CONSTRAINT chronicle_id_check CHECK (id = 'the-chronicle');
-- (only possible once every non-canonical row has been removed.)
