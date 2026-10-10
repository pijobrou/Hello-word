"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useSyncExternalStore } from "react";
import { submitContact } from "@/app/actions/contact";
import { CheckIcon, buttonClass } from "@/components/ui";
import type { Dictionary } from "@/content";
import { LIMITS, REQUEST_TYPES, type Field, type FormState, type RequestType } from "@/lib/contact";
import type { Locale } from "@/lib/i18n";
import type { SectorKey } from "@/lib/slugs";

type Props = {
  locale: Locale;
  labels: Dictionary["contact"]["form"];
  sectors: Array<{ key: SectorKey; label: string }>;
  privacyHref: string;
  defaultType?: RequestType;
  /** Secteur imposé (pages sectorielles) : le choix du secteur est masqué. */
  fixedSector?: SectorKey;
};

const noopSubscribe = () => () => {};

function useUrlType(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get("type") ?? "",
    () => "",
  );
}

const inputClass =
  "mt-2 block w-full rounded-sm border border-slate bg-white px-4 py-3 text-base text-ink placeholder:text-slate/80 transition-colors focus:border-ink focus:outline-2 focus:outline-offset-1 focus:outline-navy aria-[invalid=true]:border-[#9b1c1c]";

export function ContactForm({ locale, labels, sectors, privacyHref, defaultType = "contact", fixedSector }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitContact, { status: "idle" });
  const uid = useId();
  const startedAtRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const urlType = useUrlType();
  const initialType = (REQUEST_TYPES as readonly string[]).includes(urlType) ? urlType : defaultType;

  const errors = state.status === "error" ? state.errors : {};
  const values = state.status === "error" ? state.values : undefined;
  const hasErrors = state.status === "error";

  useEffect(() => {
    if (startedAtRef.current && !startedAtRef.current.value) startedAtRef.current.value = String(Date.now());
    if (state.status === "error") summaryRef.current?.focus();
    if (state.status === "success") successRef.current?.focus();
  }, [state]);

  const id = (field: string) => `${uid}-${field}`;
  const describedBy = (field: Field, hint?: boolean) =>
    [hint ? id(`${field}-hint`) : null, errors[field] ? id(`${field}-error`) : null].filter(Boolean).join(" ") ||
    undefined;

  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={id(`${field}-error`)} className="mt-2 text-sm font-medium text-[#9b1c1c]">
        {labels.errors[errors[field]!]}
      </p>
    ) : null;

  const label = (field: string, text: string, optional = false) => (
    <label htmlFor={id(field)} className="block text-sm font-semibold text-ink">
      {text}
      {optional ? <span className="font-normal text-muted"> ({labels.optional})</span> : null}
    </label>
  );

  if (state.status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-sm border border-line bg-white p-8 focus:outline-none sm:p-10"
      >
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-night text-champagne">
          <CheckIcon className="size-6" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold text-ink">{labels.success.title}</h2>
        <p className="mt-3 leading-relaxed text-muted">{labels.success.body}</p>
        <button type="button" onClick={() => window.location.reload()} className={buttonClass("outlineDark", "mt-8")}>
          {labels.success.again}
        </button>
      </div>
    );
  }

  const errorEntries = Object.entries(errors) as Array<[Field, NonNullable<(typeof errors)[Field]>]>;
  const formError = state.status === "error" ? state.formError : undefined;

  return (
    <form action={action} noValidate className="space-y-7" aria-describedby={hasErrors ? id("summary") : undefined}>
      {hasErrors ? (
        <div
          ref={summaryRef}
          id={id("summary")}
          tabIndex={-1}
          role="alert"
          className="rounded-sm border-l-4 border-[#9b1c1c] bg-white p-5 text-sm text-ink focus:outline-none"
        >
          {formError ? (
            <p className="font-semibold">{labels.errors[formError]}</p>
          ) : (
            <>
              <p className="font-semibold">{labels.errors.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errorEntries.map(([field, key]) => (
                  <li key={field}>
                    <a href={`#${id(field === "type" ? "type-0" : field)}`} className="underline underline-offset-2">
                      {labels.errors[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <input type="hidden" name="locale" value={locale} />
      <input ref={startedAtRef} type="hidden" name="startedAt" defaultValue="" />
      {/* Pot de miel : invisible pour les personnes, rempli par les robots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={id("website")}>{labels.honeypot}</label>
        <input id={id("website")} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {/* La clé remonte le groupe lorsque le type issu de l’URL est connu (après hydratation). */}
      <fieldset key={initialType} aria-describedby={errors.type ? id("type-error") : undefined}>
        <legend className="text-sm font-semibold text-ink">{labels.legendType}</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {REQUEST_TYPES.map((type, i) => (
            <label
              key={type}
              htmlFor={id(`type-${i}`)}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border border-slate bg-white px-4 py-3 text-sm text-ink transition-colors has-[:checked]:border-night has-[:checked]:bg-night has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-navy"
            >
              <input
                id={id(`type-${i}`)}
                type="radio"
                name="type"
                value={type}
                defaultChecked={(values?.type ?? initialType) === type}
                className="size-4 accent-champagne focus:outline-none"
              />
              {labels.types[type]}
            </label>
          ))}
        </div>
        {fieldError("type")}
      </fieldset>

      <div className="grid gap-7 sm:grid-cols-2">
        <div>
          {label("name", labels.name)}
          <input
            id={id("name")}
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={LIMITS.name}
            defaultValue={values?.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy("name")}
            className={inputClass}
          />
          {fieldError("name")}
        </div>
        <div>
          {label("email", labels.email)}
          <input
            id={id("email")}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            maxLength={254}
            defaultValue={values?.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy("email")}
            className={inputClass}
          />
          {fieldError("email")}
        </div>
      </div>

      <div className={`grid gap-7 ${fixedSector ? "" : "sm:grid-cols-2"}`}>
        <div>
          {label("organization", labels.organization, true)}
          <input
            id={id("organization")}
            name="organization"
            type="text"
            autoComplete="organization"
            maxLength={LIMITS.organization}
            defaultValue={values?.organization}
            aria-invalid={errors.organization ? true : undefined}
            aria-describedby={describedBy("organization")}
            className={inputClass}
          />
          {fieldError("organization")}
        </div>
        {fixedSector ? (
          <input type="hidden" name="sector" value={fixedSector} />
        ) : (
          <div>
            {label("sector", labels.sector, true)}
            <select
              id={id("sector")}
              name="sector"
              defaultValue={values?.sector ?? ""}
              aria-invalid={errors.sector ? true : undefined}
              aria-describedby={describedBy("sector")}
              className={`${inputClass} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M4 6l4 4 4-4%22 fill=%22none%22 stroke=%22%23172235%22 stroke-width=%221.5%22/></svg>')] bg-[length:1rem] bg-[position:right_1rem_center] bg-no-repeat pr-10`}
            >
              <option value="">{labels.sectorPlaceholder}</option>
              {sectors.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
              <option value="other">{labels.sectorOther}</option>
            </select>
            {fieldError("sector")}
          </div>
        )}
      </div>

      <div>
        {label("message", labels.message)}
        <p id={id("message-hint")} className="mt-1 text-sm text-muted">
          {labels.messageHint}
        </p>
        <textarea
          id={id("message")}
          name="message"
          rows={6}
          required
          minLength={LIMITS.messageMin}
          maxLength={LIMITS.messageMax}
          defaultValue={values?.message}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy("message", true)}
          className={`${inputClass} resize-y`}
        />
        {fieldError("message")}
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id={id("consent")}
            name="consent"
            type="checkbox"
            required
            defaultChecked={values?.consent}
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={describedBy("consent")}
            className="mt-1 size-5 shrink-0 accent-night"
          />
          <label htmlFor={id("consent")} className="text-sm leading-relaxed text-ink">
            {labels.consentBefore}
            <Link href={privacyHref} className="font-semibold underline underline-offset-2">
              {labels.consentLink}
            </Link>
            {labels.consentAfter}
          </label>
        </div>
        {fieldError("consent")}
      </div>

      <button type="submit" disabled={pending} className={buttonClass("night", "w-full disabled:opacity-70 sm:w-auto")}>
        {pending ? labels.sending : labels.submit}
      </button>
    </form>
  );
}
