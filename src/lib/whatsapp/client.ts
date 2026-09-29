/**
 * WhatsApp Cloud API (Meta) — text messages and OTP delivery.
 *
 * Required env:
 * - META_WHATSAPP_ACCESS_TOKEN — permanent or system user token with whatsapp_business_messaging
 * - META_WHATSAPP_PHONE_NUMBER_ID — from Meta App → WhatsApp → API Setup
 *
 * Optional:
 * - META_WHATSAPP_API_VERSION (default v21.0)
 * - META_WHATSAPP_OTP_TEMPLATE_NAME + META_WHATSAPP_OTP_TEMPLATE_LANG (default en)
 *   When set, OTP uses an approved authentication template instead of free-form text.
 */
import type { SmsResult } from "@/lib/sms/client";

export type WhatsappResult = SmsResult;

type MetaConfig = {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
};

function getMetaWhatsappConfig(): MetaConfig | { error: string } {
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.META_WHATSAPP_API_VERSION?.trim() || "v21.0";

  if (!token || !phoneNumberId) {
    return {
      error:
        "WhatsApp not configured (META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID)",
    };
  }
  return { token, phoneNumberId, apiVersion };
}

/** Meta expects the recipient without a leading +. */
export function toMetaWhatsappRecipient(e164: string): string {
  return e164.replace(/\D/g, "");
}

type MetaSendResponse = {
  messages?: { id: string }[];
  error?: { message?: string; error_user_msg?: string };
};

async function postWhatsappMessage(body: Record<string, unknown>): Promise<WhatsappResult> {
  const cfg = getMetaWhatsappConfig();
  if ("error" in cfg) return { ok: false, error: cfg.error };

  const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...body,
    }),
  });

  const json = (await res.json()) as MetaSendResponse;
  if (!res.ok) {
    const msg =
      json.error?.error_user_msg ?? json.error?.message ?? res.statusText ?? "WhatsApp send failed";
    return { ok: false, error: msg };
  }

  return { ok: true, providerId: json.messages?.[0]?.id };
}

export async function sendWhatsappTextMessage(params: {
  toE164: string;
  body: string;
}): Promise<WhatsappResult> {
  const to = toMetaWhatsappRecipient(params.toE164);
  if (!to) return { ok: false, error: "Invalid phone number" };

  return postWhatsappMessage({
    to,
    type: "text",
    text: { preview_url: false, body: params.body },
  });
}

export async function sendWhatsappOtpMessage(params: {
  toE164: string;
  code: string;
  parishName?: string;
}): Promise<WhatsappResult> {
  const templateName = process.env.META_WHATSAPP_OTP_TEMPLATE_NAME?.trim();
  const templateLang = process.env.META_WHATSAPP_OTP_TEMPLATE_LANG?.trim() || "en";
  const to = toMetaWhatsappRecipient(params.toE164);
  if (!to) return { ok: false, error: "Invalid phone number" };

  if (templateName) {
    return postWhatsappMessage({
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLang },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: params.code }],
          },
        ],
      },
    });
  }

  const body = params.parishName
    ? `${params.parishName}: your sign-in code is ${params.code}. It expires in 10 minutes.`
    : `Your ChMS sign-in code is ${params.code}. It expires in 10 minutes.`;

  return sendWhatsappTextMessage({ toE164: params.toE164, body });
}

export function isWhatsappConfigured(): boolean {
  return !("error" in getMetaWhatsappConfig());
}
