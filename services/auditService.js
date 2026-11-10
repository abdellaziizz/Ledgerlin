import { pool } from "../db.js";

/**
 * Appends a row to audit_log. Pass the transaction's client so the audit row commits
 * (or rolls back) together with the change it describes.
 */
export async function audit(db, { actorId = null, action, entityType = null, entityId = null, metadata = {} }) {
  await (db ?? pool).query(
    `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, entityType, entityId === null ? null : String(entityId), metadata],
  );
}
