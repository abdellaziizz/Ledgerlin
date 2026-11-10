-- Same rule as 001's check_transfer_balanced (>= 2 entries, net zero per currency), rewritten so it
-- only touches the rows it needs.
--
-- Why: 001 joined entries to accounts in one query. On a small accounts table the planner picks a
-- sequential scan, and under SERIALIZABLE a sequential scan takes a predicate lock on the WHOLE
-- relation, so every concurrent transfer looked like a read/write conflict (40001) even when the
-- two transfers shared no account. Looking accounts up by primary key takes tuple-level locks only.
-- Measured in docs/design-notes.md ("SERIALIZABLE false positives").

CREATE OR REPLACE FUNCTION check_transfer_balanced() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  r     record;
  cur   char(3);
  nets  jsonb := '{}'::jsonb;
  n     int := 0;
  k     text;
BEGIN
  FOR r IN
    SELECT account_id, direction, amount_minor FROM entries WHERE transfer_id = NEW.transfer_id
  LOOP
    n := n + 1;
    SELECT currency INTO cur FROM accounts WHERE id = r.account_id; -- primary-key lookup
    nets := jsonb_set(
      nets, ARRAY[cur],
      to_jsonb(COALESCE((nets ->> cur)::numeric, 0)
               + CASE r.direction WHEN 'credit' THEN r.amount_minor ELSE -r.amount_minor END)
    );
  END LOOP;

  IF n < 2 THEN
    RAISE EXCEPTION 'transfer % has % entries; need at least 2', NEW.transfer_id, n
      USING ERRCODE = 'check_violation';
  END IF;

  FOR k IN SELECT jsonb_object_keys(nets) LOOP
    IF (nets ->> k)::numeric <> 0 THEN
      RAISE EXCEPTION 'transfer % is unbalanced in % (net %)', NEW.transfer_id, k, nets ->> k
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NULL;
END $$;
