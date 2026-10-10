import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ArrowIcon, Container, Eyebrow } from "@/components/ui";
import { getDictionary } from "@/content";
import { findArticle, visibleArticles } from "@/content/insights";
import { href, htmlLang, isLocale, locales, type Locale } from "@/lib/i18n";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { articleSlugs } from "@/lib/slugs";

export const dynamicParams = false;

export function generateStaticParams({ params }: { params: { locale: string } }) {
  const locale = (isLocale(params.locale) ? params.locale : "fr") as Locale;
  return visibleArticles().map((a) => ({ slug: articleSlugs[a.key][locale] }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/insights/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const article = findArticle(locale, slug);
  if (!article) return {};
  return buildMetadata({
    locale,
    route: "insights",
    rest: Object.fromEntries(locales.map((l) => [l, [articleSlugs[article.key][l]]])) as Record<Locale, string[]>,
    title: article[locale].title,
    description: article[locale].excerpt,
    type: "article",
    noindex: article.status === "draft",
  });
}

export default async function ArticlePage({ params }: PageProps<"/[locale]/insights/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const article = findArticle(locale, slug);
  if (!article) notFound();
  const dict = getDictionary(locale);
  const { insights } = dict;
  const a = article[locale];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.excerpt,
    inLanguage: htmlLang[locale],
    ...(article.date ? { datePublished: article.date } : {}),
    author: { "@type": "Organization", name: dict.meta.siteName },
    publisher: { "@id": `${absoluteUrl("")}/#organization` },
    mainEntityOfPage: absoluteUrl(href(locale, "insights", slug)),
  };

  return (
    <article>
      <header className="surface-night">
        <Container className="py-20 sm:py-24">
          <div className="mx-auto max-w-3xl">
            <Eyebrow dark>{insights.topics[article.topic]}</Eyebrow>
            <h1 className="mt-6 text-headline font-semibold text-balance text-white">{a.title}</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">{a.excerpt}</p>
            <p className="mt-6 text-sm text-muted">
              {article.readingMinutes} {insights.readingTime}
              {article.date ? (
                <>
                  {" · "}
                  {insights.published}{" "}
                  <time dateTime={article.date}>
                    {new Intl.DateTimeFormat(htmlLang[locale], { dateStyle: "long", timeZone: "UTC" }).format(
                      new Date(article.date),
                    )}
                  </time>
                </>
              ) : null}
            </p>
          </div>
        </Container>
      </header>
      <Container className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          {article.status === "draft" ? (
            <p role="note" className="mb-10 border-l-2 border-champagne bg-mist p-4 text-sm text-ink">
              {insights.draftNotice}
            </p>
          ) : null}
          <div className="prose-avoryn text-lg leading-relaxed text-ink">
            {a.sections.map((section, i) => (
              <section key={section.heading ?? i}>
                {section.heading ? <h2>{section.heading}</h2> : null}
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {section.list ? (
                  <ul>
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <Link
            href={href(locale, "insights")}
            className="mt-14 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline decoration-champagne underline-offset-[6px]"
          >
            <ArrowIcon className="size-4 rotate-180" />
            {insights.back}
          </Link>
        </div>
      </Container>
      <JsonLd data={jsonLd} />
    </article>
  );
}
