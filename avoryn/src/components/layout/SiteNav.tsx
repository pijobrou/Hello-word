"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { htmlLang, otherLocale, type Locale } from "@/lib/i18n";
import { translatePath } from "@/lib/slugs";
import { CloseIcon, MenuIcon } from "@/components/ui";

type NavItem = { href: string; label: string };

type Props = {
  locale: Locale;
  items: NavItem[];
  contact: NavItem;
  labels: { primary: string; menuOpen: string; menuClose: string; switchLabel: string; switchTitle: string };
};

function isActive(pathname: string, href: string, locale: Locale): boolean {
  if (href === `/${locale}`) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNav({ locale, items, contact, labels }: Props) {
  const pathname = usePathname() ?? `/${locale}`;
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const target = otherLocale(locale);
  const switchHref = translatePath(pathname, target);

  // Referme le menu après une navigation.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const linkClass = (active: boolean) =>
    `relative inline-flex min-h-11 items-center px-1 text-[0.9rem] transition-colors duration-200 ${
      active ? "text-white" : "text-white/75 hover:text-white"
    } after:absolute after:inset-x-1 after:bottom-1.5 after:h-px after:bg-champagne after:transition-transform after:duration-300 ${
      active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"
    } after:origin-left`;

  const languageLink = (
    <Link
      href={switchHref}
      hrefLang={htmlLang[target]}
      lang={htmlLang[target]}
      title={labels.switchTitle}
      aria-label={labels.switchTitle}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-white/25 px-3 text-xs font-semibold tracking-[0.15em] text-white transition-colors hover:border-champagne hover:text-champagne"
    >
      {labels.switchLabel}
    </Link>
  );

  return (
    <>
      <nav aria-label={labels.primary} className="hidden lg:block">
        <ul className="flex items-center gap-4 xl:gap-6">
          {items.map((item) => {
            const active = isActive(pathname, item.href, locale);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={linkClass(active)}>
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href={contact.href}
              aria-current={isActive(pathname, contact.href, locale) ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-sm bg-champagne px-5 text-sm font-semibold text-night transition-colors hover:bg-white"
            >
              {contact.label}
            </Link>
          </li>
          <li>{languageLink}</li>
        </ul>
      </nav>

      <div className="flex items-center gap-2 lg:hidden">
        {languageLink}
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? labels.menuClose : labels.menuOpen}
          onClick={() => {
            setOpenedAt(pathname);
            setOpen((value) => !value);
          }}
          className="inline-flex size-11 items-center justify-center rounded-sm text-white hover:text-champagne"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        className="surface-night fixed inset-x-0 top-[var(--header-height)] bottom-0 z-40 overflow-y-auto border-t border-white/10 lg:hidden"
      >
        <nav aria-label={labels.primary} className="px-4 py-8 sm:px-6">
          <ul className="space-y-1">
            {[...items, contact].map((item) => {
              const active = isActive(pathname, item.href, locale);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center justify-between border-b border-white/10 py-3 text-xl ${
                      active ? "text-champagne" : "text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
