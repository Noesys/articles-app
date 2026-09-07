import type { Bindings } from "../types/shared-types";

export async function sendOTPEmail(
  env: Bindings,
  email: string,
  otp: string
): Promise<boolean> {
  const apiKey = env.SENDGRID_API_KEY;
  const fromEmail = (env.FROM_EMAIL ?? "").trim();

  if (!apiKey) {
    console.error("SENDGRID_API_KEY is missing");
    return false;
  }

  if (!fromEmail) {
    console.error("FROM_EMAIL is missing - set via wrangler secret (wrangler secret put FROM_EMAIL)");
    return false;
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: {
          email: fromEmail,
          name: "Article Platform",
        },
        subject: "Your Article Platform Login Code",
        content: [
          {
            type: "text/plain",
            value: `Your login code is ${otp}. It expires in 5 minutes.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Email] SendGrid API error: ${response.status}`, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Email] Failed to send OTP email:", error);
    return false;
  }
}
