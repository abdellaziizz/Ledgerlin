-- audit_log is evidence: like entries, rows can be added but never changed or removed.

CREATE FUNCTION audit_log_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% not allowed)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END $$;

CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- Supports "recent activity" queries on the audit trail.
CREATE INDEX audit_log_action_idx ON audit_log (action, id);
