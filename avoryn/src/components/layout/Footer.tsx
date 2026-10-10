import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui";
import type { Dictionary } from "@/content";
import { href, type Locale, type RouteKey } from "@/lib/i18n";
import { site } from "@/lib/site";

const EXPLORE: RouteKey[] = ["solutions", "technologies", "sectors", "method"];
const COMPANY: RouteKey[] = ["about", "innovations", "insights", "contact"];

export function Footer({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const year = new Date().getFullYear();
  const owner = site.legalName ?? dict.meta.siteName;
  const linkClass = "inline-flex min-h-11 items-center text-sm text-white/75 transition-colors hover:text-champagne";

  const column = (title: string, keys: RouteKey[]) => (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-champagne">{title}</h2>
      <ul className="mt-4">
        {keys.map((key) => (
          <li key={key}>
            <Link href={href(locale, key)} className={linkClass}>
              {dict.nav[key as keyof Dictionary["nav"]]}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  const { email, phone, city, linkedin } = site.contact;

  return (
    <footer className="surface-night border-t border-white/10">
      <Container className="py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo className="text-[1.05rem] text-champagne" title={dict.meta.siteName} />
            <p className="mt-6 text-lg font-medium text-white">{dict.meta.slogan}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{dict.footer.summary}</p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3 lg:col-span-7">
            {column(dict.footer.explore, EXPLORE)}
            {column(dict.footer.company, COMPANY)}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-champagne">
                {dict.footer.information}
              </h2>
              <ul className="mt-4">
                <li>
                  <Link href={href(locale, "privacy")} className={linkClass}>
                    {dict.footer.privacy}
                  </Link>
                </li>
                <li>
                  <Link href={href(locale, "brand")} className={linkClass}>
                    {dict.footer.brand}
                  </Link>
                </li>
                {email ? (
                  <li>
                    <a href={`mailto:${email}`} className={linkClass}>
                      {email}
                    </a>
                  </li>
                ) : (
                  <li>
                    <Link href={href(locale, "contact")} className={linkClass}>
                      {dict.footer.contactCta}
                    </Link>
                  </li>
                )}
                {phone ? (
                  <li>
                    <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className={linkClass}>
                      {phone}
                    </a>
                  </li>
                ) : null}
                {linkedin ? (
                  <li>
                    <a href={linkedin} className={linkClass} rel="noopener noreferrer" target="_blank">
                      LinkedIn
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-white/10 pt-8 text-xs text-muted sm:flex-row sm:justify-between">
          <p>
            © {year} {owner}. {dict.footer.rights}
          </p>
          <p>{city ? `${city} · ` : ""}{dict.footer.origin}</p>
        </div>
      </Container>
    </footer>
  );
}
