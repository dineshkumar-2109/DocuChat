import { Router } from "express";
import crypto from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { query } from "../db/pool.js";
import { signToken } from "../middleware/auth.js";
import { asyncHandler, validateBody } from "../middleware/validate.js";
import { httpError } from "../middleware/error.js";

const router = Router();

// Password hashing with Node's built-in scrypt (no extra dependency). The
// async version runs on the thread pool, so a login doesn't block every
// other request while it hashes.
const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)).toString("hex");
  return `${salt}:${hash}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const candidate = await scrypt(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

router.post(
  "/register",
  validateBody(credentials),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const id = crypto.randomUUID();

    try {
      await query("INSERT INTO users (id, email, password) VALUES ($1, $2, $3)", [id, email, await hashPassword(password)]);
    } catch (err) {
      if (err.code === "23505" || /unique|duplicate/i.test(err.message)) throw httpError(409, "Email already registered");
      throw err;
    }

    res.status(201).json({ token: signToken({ id, email }), user: { id, email } });
  })
);

router.post(
  "/login",
  validateBody(credentials),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await query("SELECT id, email, password FROM users WHERE email = $1", [email]);
    const user = rows[0];
    if (!user || !(await verifyPassword(password, user.password))) {
      throw httpError(401, "Invalid email or password");
    }
    res.json({ token: signToken({ id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
  })
);

export default router;
