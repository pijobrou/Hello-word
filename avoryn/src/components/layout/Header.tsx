import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/content";
import { href, type Locale, type RouteKey } from "@/lib/i18n";
import { SiteNav } from "./SiteNav";

const NAV: RouteKey[] = ["home", "about", "solutions", "technologies", "sectors", "innovations", "insights"];

export function Header({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const items = NAV.map((key) => ({ href: href(locale, key), label: dict.nav[key as keyof Dictionary["nav"]] }));

  return (
    <header className="surface-night sticky top-0 z-50 h-[var(--header-height)] border-b border-white/10">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          href={href(locale, "home")}
          aria-label={dict.nav.homeLabel}
          className="inline-flex min-h-11 items-center text-champagne"
        >
          <Logo title={dict.nav.homeLabel} className="text-[0.95rem]" />
        </Link>
        <SiteNav
          locale={locale}
          items={items}
          contact={{ href: href(locale, "contact"), label: dict.nav.contact }}
          labels={{
            primary: dict.nav.primary,
            menuOpen: dict.nav.menuOpen,
            menuClose: dict.nav.menuClose,
            switchLabel: dict.nav.switchLabel,
            switchTitle: dict.nav.switchTitle,
          }}
        />
      </div>
    </header>
  );
}
