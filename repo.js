import { pool, withTransaction } from "./db.js";
const createUser = async (email, passwordHash) => {
  const result = await pool.query(
    "INSERT INTO users(email,password_hash) VALUES ($1, $2) RETURNING id, email, role, created_at",
    [email, passwordHash],
  );
  return result.rows[0];
};
const findUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT id, email, password_hash, role FROM users WHERE email = $1",
    [email],
  );
  return result.rows[0]; // undefined if not found
};
const findUserById = async (id) => {
  const result = await pool.query(
    "SELECT id, email, role FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0];
};
export default { createUser, findUserByEmail, findUserById };
