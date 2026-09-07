-- Migration number: 001 	 2026-08-19T08:35:52.000Z
PRAGMA foreign_keys = ON;

CREATE TABLE otp_codes (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'login',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    used_at TEXT
);

CREATE INDEX idx_otp_codes_email ON otp_codes (email);
CREATE INDEX idx_otp_codes_email_code ON otp_codes (email, code);