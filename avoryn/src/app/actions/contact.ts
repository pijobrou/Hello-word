"use server";

import { headers } from "next/headers";
import { looksAutomated, readValues, validate, type ContactInput, type FormState } from "@/lib/contact";

/* ------------------------------------------------------------------------ */
/* Limitation du débit (mémoire du processus)                                 */
/* Suffisant pour un site institutionnel ; sur une plateforme serverless,     */
/* chaque instance a son propre compteur (voir docs/SECURITY.md).             */
/* ------------------------------------------------------------------------ */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.CONTACT_RATE_LIMIT ?? 5);
const hits = new Map<string, number[]>();

function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  // Nettoyage opportuniste : aucune adresse IP n'est conservée au-delà de la fenêtre.
  if (hits.size > 5000) {
    for (const [k, times] of hits) if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
  return false;
}

/* ------------------------------------------------------------------------ */
/* Acheminement                                                               */
/* ------------------------------------------------------------------------ */

type Mode = "resend" | "webhook" | "log" | "disabled";

function deliveryMode(): Mode {
  const explicit = process.env.CONTACT_DELIVERY;
  if (explicit === "resend" || explicit === "webhook" || explicit === "log" || explicit === "disabled") return explicit;
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.CONTACT_WEBHOOK_URL) return "webhook";
  return process.env.NODE_ENV === "production" ? "disabled" : "log";
}

const TYPE_LABELS: Record<ContactInput["type"], string> = {
  contact: "Question générale / General enquiry",
  project: "Demande de projet / Project request",
  partnership: "Partenariat / Partnership",
};

function plainText(data: ContactInput, locale: string): string {
  return [
    `Type : ${TYPE_LABELS[data.type]}`,
    `Langue : ${locale}`,
    `Nom : ${data.name}`,
    `Courriel : ${data.email}`,
    `Organisation : ${data.organization || "—"}`,
    `Secteur : ${data.sector}`,
    "",
    data.message,
  ].join("\n");
}

async function deliver(data: ContactInput, locale: string): Promise<"ok" | "unavailable" | "failed"> {
  const mode = deliveryMode();
  const subject = `[AVORYN] ${TYPE_LABELS[data.type]} — ${data.name}`.slice(0, 180);

  if (mode === "disabled") return "unavailable";

  if (mode === "log") {
    // Mode développement / tests : aucune donnée personnelle n'est journalisée.
    console.info("[contact] demande reçue (mode log)", {
      type: data.type,
      sector: data.sector,
      locale,
      messageLength: data.message.length,
    });
    return "ok";
  }

  try {
    if (mode === "resend") {
      const { RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL } = process.env;
      if (!RESEND_API_KEY || !CONTACT_TO_EMAIL || !CONTACT_FROM_EMAIL) return "unavailable";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: CONTACT_FROM_EMAIL,
          to: CONTACT_TO_EMAIL.split(",").map((s) => s.trim()),
          reply_to: data.email,
          subject,
          text: plainText(data, locale),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? "ok" : "failed";
    }

    const url = process.env.CONTACT_WEBHOOK_URL;
    if (!url) return "unavailable";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CONTACT_WEBHOOK_SECRET ? { Authorization: `Bearer ${process.env.CONTACT_WEBHOOK_SECRET}` } : {}),
      },
      body: JSON.stringify({ subject, locale, receivedAt: new Date().toISOString(), ...data }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

/* ------------------------------------------------------------------------ */
/* Action                                                                     */
/* ------------------------------------------------------------------------ */

export async function submitContact(_prev: FormState, form: FormData): Promise<FormState> {
  const values = readValues(form);
  const locale = form.get("locale") === "en" ? "en" : "fr";

  const result = validate(values);
  if (!result.ok) return { status: "error", errors: result.errors, values };

  if (looksAutomated(form)) {
    return { status: "error", errors: {}, formError: "rejected", values };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) {
    return { status: "error", errors: {}, formError: "rateLimited", values };
  }

  const outcome = await deliver(result.data, locale);
  if (outcome === "ok") return { status: "success" };
  return {
    status: "error",
    errors: {},
    formError: outcome === "unavailable" ? "unavailable" : "server",
    values,
  };
}
