import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { api, registerUser, uniqueEmail } from "../helpers.js";

describe("auth", () => {
  it("registers, logs in and returns the current user", async () => {
    const email = uniqueEmail();
    const reg = await api().post("/api/v1/auth/register").send({ email: email.toUpperCase(), password: "password-123" }).expect(201);
    expect(reg.body.token).toBeTypeOf("string");
    expect(reg.body.data.user).toMatchObject({ email, role: "customer" });
    expect(reg.body.data.user.password_hash).toBeUndefined();

    const login = await api().post("/api/v1/auth/login").send({ email, password: "password-123" }).expect(200);
    const me = await api().get("/api/v1/auth/me").set("Authorization", `Bearer ${login.body.token}`).expect(200);
    expect(me.body.data.user.email).toBe(email);
  });

  it("rejects a duplicate email with 409", async () => {
    const { email } = await registerUser();
    const res = await api().post("/api/v1/auth/register").send({ email, password: "password-123" }).expect(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const { email } = await registerUser();
    const a = await api().post("/api/v1/auth/login").send({ email, password: "wrong-password" }).expect(401);
    const b = await api().post("/api/v1/auth/login").send({ email: uniqueEmail(), password: "wrong-password" }).expect(401);
    expect(a.body).toEqual(b.body);
  });

  it("never stores the plain password", async () => {
    const { pool } = await import("../../db.js");
    const { email } = await registerUser();
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE email = $1", [email]);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
  });

  it("rejects missing, invalid and expired tokens", async () => {
    await api().get("/api/v1/accounts").expect(401);
    const bad = await api().get("/api/v1/accounts").set("Authorization", "Bearer not-a-jwt").expect(401);
    expect(bad.body.code).toBe("TOKEN_INVALID");
    const { user } = await registerUser();
    const expired = jwt.sign({ id: user.id, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
    const res = await api().get("/api/v1/accounts").set("Authorization", `Bearer ${expired}`).expect(401);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  it("validates input", async () => {
    const res = await api().post("/api/v1/auth/register").send({ email: "nope", password: "x" }).expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
