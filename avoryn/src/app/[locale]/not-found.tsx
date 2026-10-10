"use client";

import { usePathname } from "next/navigation";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";
import { en } from "@/content/en";
import { fr } from "@/content/fr";

// not-found ne reçoit pas les paramètres de route : la langue est déduite de l'URL.
export default function NotFound() {
  const pathname = usePathname() ?? "/fr";
  const locale = pathname.startsWith("/en") ? "en" : "fr";
  const t = (locale === "en" ? en : fr).notFound;

  return (
    <section className="surface-night">
      <title>{`${(locale === "en" ? en : fr).pages.notFound.title} | AVORYN`}</title>
      <meta name="robots" content="noindex" />
      <Container className="py-28 sm:py-36">
        <div className="max-w-2xl">
          <Eyebrow dark>{t.eyebrow}</Eyebrow>
          <h1 className="mt-6 text-headline font-semibold text-white">{t.title}</h1>
          <p className="mt-5 text-lg text-muted">{t.body}</p>
          <ButtonLink href={`/${locale}`} variant="gold" arrow className="mt-10">
            {t.cta}
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
