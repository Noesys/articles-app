import { Hono } from "hono";
import type { AppEnv } from "../../types/shared-types";
import { findUserByEmail, createUser, getUserById } from "../../services/user/users";
import {
  createOtpCode,
  getValidOtp,
  markOtpUsed,
  invalidatePendingOtps,
} from "../../services/user/otpCodes";
import { signJwt } from "../../utils/jwt";
import { authMiddleware } from "../../middleware/userAuth";
import { sendOTPEmail } from "../../utils/email";

const authRoutes = new Hono<AppEnv>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX = /^\d{6}$/;

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function nameFromEmail(email: string): string {
  return email.split("@")[0] || "User";
}

/* Removed local sendOtpEmail */

authRoutes.post("/otp/request", async (c) => {
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        message: "Invalid JSON body",
      },
      400
    );
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return c.json(
      {
        success: false,
        message: "A valid email address is required",
      },
      400
    );
  }

  const db = c.env.DB;
  let user = await findUserByEmail(db, email);

  if (!user) {
    const now = new Date().toISOString();
    const newUser = {
      id: "usr_" + crypto.randomUUID(),
      email,
      name: nameFromEmail(email),
      auth_role: "user",
      job_role: "",
      created_at: now,
      created_by: null,
      is_active: 1,
    };
    await createUser(db, newUser);
    user = await findUserByEmail(db, email);
  }

  if (!user || user.is_active !== 1) {
    return c.json(
      {
        success: false,
        message: "This account is inactive",
      },
      403
    );
  }

  await invalidatePendingOtps(db, email);

  const now = new Date();
  const otpCode = {
    id: "otp_" + crypto.randomUUID(),
    email,
    code: generateOtp(),
    purpose: "login",
    expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    created_at: now.toISOString(),
  };

  await createOtpCode(db, otpCode);

  // Fire-and-forget email; failure does not block login (works offline/locally)
  // Use waitUntil if available so it doesn't block response, otherwise just don't await
  try {
    const p = sendOTPEmail(c.env, email, otpCode.code);
    if (c.executionCtx?.waitUntil) c.executionCtx.waitUntil(p.catch((e) => console.error("[Email] async error:", e)));
    else p.catch((e) => console.error("[Email] async error:", e));
  } catch (e) {
    console.error("[Email] sync error:", e);
  }

  return c.json({
    success: true,
    message: "OTP sent successfully",
    data: {
      expires_in: 600,
    },
  });
});

authRoutes.post("/otp/verify", async (c) => {
  let body: { email?: string; code?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        message: "Invalid JSON body",
      },
      400
    );
  }

  const email = (body.email || "").trim().toLowerCase();
  const code = (body.code || "").trim();

  if (!email || !EMAIL_REGEX.test(email)) {
    return c.json(
      {
        success: false,
        message: "A valid email address is required",
      },
      400
    );
  }

  if (!OTP_REGEX.test(code)) {
    return c.json(
      {
        success: false,
        message: "A valid 6-digit code is required",
      },
      400
    );
  }

  const db = c.env.DB;
  const otp = await getValidOtp(db, email, code);
  if (!otp) {
    return c.json(
      {
        success: false,
        message: "Invalid or expired code",
      },
      401
    );
  }

  await markOtpUsed(db, otp.id, new Date().toISOString());

  const user = await findUserByEmail(db, email);
  if (!user || user.is_active !== 1) {
    return c.json(
      {
        success: false,
        message: "Account not found or inactive",
      },
      403
    );
  }

  const token = await signJwt(c.env, {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.auth_role,
  });

  return c.json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        job_role: user.job_role,
        auth_role: user.auth_role,
      },
    },
  });
});

authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");

  const dbUser = await getUserById(c.env.DB, user.id);

  return c.json({
    success: true,
    message: "User authenticated successfully",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      job_role: dbUser?.job_role ?? user.job_role,
      auth_role: dbUser?.auth_role ?? user.auth_role,
      is_active: dbUser ? dbUser.is_active === 1 : true,
    },
  });
});

export default authRoutes;