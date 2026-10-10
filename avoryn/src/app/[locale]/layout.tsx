import "@fontsource-variable/inter";
import "../globals.css";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { JsonLd } from "@/components/JsonLd";
import { getDictionary } from "@/content";
import { href, htmlLang, isLocale, locales } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#101C2D",
  colorScheme: "light",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: dict.pages.home.title, template: `%s | ${dict.meta.siteName}` },
    description: dict.meta.description,
    applicationName: dict.meta.siteName,
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  const organization = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site.url}/#organization`,
        name: dict.meta.siteName,
        ...(site.legalName ? { legalName: site.legalName } : {}),
        slogan: dict.meta.slogan,
        description: dict.meta.description,
        url: absoluteUrl(href(locale, "home")),
        logo: absoluteUrl("/brand/avoryn-vertical-gold-on-night.svg"),
        areaServed: "CA",
        ...(site.contact.email ? { email: site.contact.email } : {}),
        ...(site.contact.linkedin ? { sameAs: [site.contact.linkedin] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${site.url}/#website`,
        name: dict.meta.siteName,
        url: site.url,
        inLanguage: [htmlLang.fr, htmlLang.en],
        publisher: { "@id": `${site.url}/#organization` },
      },
    ],
  };

  return (
    <html lang={htmlLang[locale]}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-[60] rounded-sm bg-champagne px-4 py-3 font-semibold text-night focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {dict.nav.skip}
        </a>
        <Header locale={locale} dict={dict} />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <Footer locale={locale} dict={dict} />
        <JsonLd data={organization} />
      </body>
    </html>
  );
}
