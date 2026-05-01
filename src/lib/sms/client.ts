/**
 * Server-side SMS via Twilio REST (no SDK). Set TWILIO_* env vars on Vercel.
 */
export type SmsResult =
  | { ok: true; providerId?: string }
  | { ok: false; error: string };

export async function sendSmsViaTwilio(params: {
  to: string;
  body: string;
}): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    return { ok: false, error: "SMS not configured (missing Twilio env vars)" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({
        To: params.to,
        From: from,
        Body: params.body,
      }),
    },
  );

  const json = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    return { ok: false, error: json.message ?? res.statusText };
  }
  return { ok: true, providerId: json.sid };
}
