import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/ContactForm";
import { PageHero } from "@/components/sections";
import { Container, Index } from "@/components/ui";
import { getDictionary } from "@/content";
import { href, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { sectorKeys } from "@/lib/slugs";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "contact", ...getDictionary(locale).pages.contact });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { contact } = dict;
  const { email, phone, city } = site.contact;

  return (
    <>
      <PageHero {...contact.hero} />
      <section className="surface-mist py-16 sm:py-24">
        <Container className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ContactForm
              locale={locale}
              labels={contact.form}
              sectors={sectorKeys.map((key) => ({ key, label: dict.sectors.items[key].title }))}
              privacyHref={href(locale, "privacy")}
            />
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <h2 className="text-xl font-semibold text-ink">{contact.aside.title}</h2>
            <ol className="mt-6 space-y-6">
              {contact.aside.steps.map((step, i) => (
                <li key={step} className="flex gap-4">
                  <Index n={i + 1} />
                  <p className="leading-relaxed text-ink">{step}</p>
                </li>
              ))}
            </ol>
            {email || phone || city ? (
              <div className="mt-10 border-t border-line pt-8">
                <h2 className="text-xl font-semibold text-ink">{contact.aside.directTitle}</h2>
                <ul className="mt-4 space-y-2 text-ink">
                  {email ? (
                    <li>
                      <a href={`mailto:${email}`} className="underline underline-offset-4">
                        {email}
                      </a>
                    </li>
                  ) : null}
                  {phone ? <li>{phone}</li> : null}
                  {city ? <li>{city}</li> : null}
                </ul>
              </div>
            ) : null}
            <div className="mt-10 border-t border-line pt-8 text-sm leading-relaxed text-muted">
              <p>{contact.aside.privacy}</p>
              <Link href={href(locale, "privacy")} className="mt-3 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
                {contact.aside.privacyLink}
              </Link>
            </div>
          </aside>
        </Container>
      </section>
    </>
  );
}
