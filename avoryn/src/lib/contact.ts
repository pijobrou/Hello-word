/**
 * Validation du formulaire de contact — logique pure, partagée et testable.
 * Les messages d'erreur sont des clés traduites dans content/{fr,en}.ts.
 */
import { isSectorKey, type SectorKey } from "./slugs";

export const REQUEST_TYPES = ["contact", "project", "partnership"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const LIMITS = { name: 120, organization: 160, messageMin: 20, messageMax: 4000 } as const;
/** Délai minimal (ms) entre l'affichage et l'envoi : en deçà, envoi automatisé probable. */
export const MIN_FILL_TIME_MS = 2500;
/** Au-delà, le formulaire est considéré comme périmé (horodatage forgé ou rejoué). */
export const MAX_FILL_TIME_MS = 1000 * 60 * 60 * 24;

export type ErrorKey =
  | "typeInvalid"
  | "nameRequired"
  | "nameTooLong"
  | "emailInvalid"
  | "organizationTooLong"
  | "sectorInvalid"
  | "messageTooShort"
  | "messageTooLong"
  | "consentRequired";

export type Field = "type" | "name" | "email" | "organization" | "sector" | "message" | "consent";

export type ContactInput = {
  type: RequestType;
  name: string;
  email: string;
  organization: string;
  sector: SectorKey | "other";
  message: string;
};

export type Values = Record<Exclude<Field, "consent">, string> & { consent: boolean };

export type ValidationResult =
  | { ok: true; data: ContactInput }
  | { ok: false; errors: Partial<Record<Field, ErrorKey>> };

/** Retire les caractères de contrôle (hors retours à la ligne dans le message). */
function clean(value: unknown, multiline = false): string {
  if (typeof value !== "string") return "";
  const pattern = multiline ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return value.replace(pattern, " ").trim();
}

// Volontairement simple : la vérification réelle se fait par la réponse à ce courriel.
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function readValues(form: FormData): Values {
  return {
    type: clean(form.get("type")),
    name: clean(form.get("name")),
    email: clean(form.get("email")).toLowerCase(),
    organization: clean(form.get("organization")),
    sector: clean(form.get("sector")),
    message: clean(form.get("message"), true),
    consent: form.get("consent") === "on",
  };
}

export function validate(values: Values): ValidationResult {
  const errors: Partial<Record<Field, ErrorKey>> = {};

  if (!(REQUEST_TYPES as readonly string[]).includes(values.type)) errors.type = "typeInvalid";

  if (!values.name) errors.name = "nameRequired";
  else if (values.name.length > LIMITS.name) errors.name = "nameTooLong";

  if (values.email.length > 254 || !EMAIL.test(values.email)) errors.email = "emailInvalid";

  if (values.organization.length > LIMITS.organization) errors.organization = "organizationTooLong";

  if (values.sector && values.sector !== "other" && !isSectorKey(values.sector)) errors.sector = "sectorInvalid";

  if (values.message.length < LIMITS.messageMin) errors.message = "messageTooShort";
  else if (values.message.length > LIMITS.messageMax) errors.message = "messageTooLong";

  if (!values.consent) errors.consent = "consentRequired";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      type: values.type as RequestType,
      name: values.name,
      email: values.email,
      organization: values.organization,
      sector: (values.sector || "other") as SectorKey | "other",
      message: values.message,
    },
  };
}

/** Signaux d'envoi automatisé : pot de miel rempli, envoi trop rapide ou horodatage invalide. */
export function looksAutomated(form: FormData, now = Date.now()): boolean {
  const honeypot = form.get("website");
  if (typeof honeypot === "string" && honeypot.trim() !== "") return true;
  // L'horodatage est posé par JavaScript ; sans JavaScript, le formulaire reste
  // utilisable et seules les autres protections s'appliquent.
  const rawStartedAt = form.get("startedAt");
  if (typeof rawStartedAt === "string" && rawStartedAt !== "") {
    const elapsed = now - Number(rawStartedAt);
    if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_TIME_MS || elapsed > MAX_FILL_TIME_MS) return true;
  }
  const message = form.get("message");
  // Messages composés surtout de liens : pourriel typique.
  if (typeof message === "string" && (message.match(/https?:\/\//gi)?.length ?? 0) > 3) return true;
  return false;
}

export type FormState =
  | { status: "idle" }
  | { status: "success" }
  | {
      status: "error";
      errors: Partial<Record<Field, ErrorKey>>;
      formError?: "rateLimited" | "rejected" | "unavailable" | "server";
      values: Values;
    };
