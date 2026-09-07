import { OtpCode } from "../../types/user-types";

const OTP_COLUMNS = `
  id,
  email,
  code,
  purpose,
  expires_at,
  created_at,
  used_at
`;

export async function createOtpCode(
  db: D1Database,
  otp: {
    id: string;
    email: string;
    code: string;
    purpose: string;
    expires_at: string;
    created_at: string;
  }
): Promise<void> {
  await db
    .prepare(
      `
        INSERT INTO otp_codes (
          id,
          email,
          code,
          purpose,
          expires_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      otp.id,
      otp.email,
      otp.code,
      otp.purpose,
      otp.expires_at,
      otp.created_at
    )
    .run();
}

export async function getValidOtp(
  db: D1Database,
  email: string,
  code: string
): Promise<OtpCode | null> {
  return db
    .prepare(
      `
        SELECT ${OTP_COLUMNS}
        FROM otp_codes
        WHERE email = ?
          AND code = ?
          AND purpose = 'login'
          AND used_at IS NULL
          AND expires_at > ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .bind(email, code, new Date().toISOString())
    .first<OtpCode>();
}

export async function markOtpUsed(
  db: D1Database,
  id: string,
  usedAt: string
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE otp_codes
        SET used_at = ?
        WHERE id = ?
      `
    )
    .bind(usedAt, id)
    .run();
}

export async function invalidatePendingOtps(
  db: D1Database,
  email: string
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE otp_codes
        SET used_at = ?
        WHERE email = ?
          AND purpose = 'login'
          AND used_at IS NULL
      `
    )
    .bind(new Date().toISOString(), email)
    .run();
}