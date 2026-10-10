import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/sections";
import { ArrowIcon, Badge, Container } from "@/components/ui";
import { getDictionary } from "@/content";
import { visibleArticles } from "@/content/insights";
import { href, htmlLang, isLocale } from "@/lib/i18n";
import { buildMetadata } from "@/lib/seo";
import { articleSlugs } from "@/lib/slugs";

export async function generateMetadata({ params }: PageProps<"/[locale]/insights">) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return buildMetadata({ locale, route: "insights", ...getDictionary(locale).pages.insights });
}

export default async function InsightsPage({ params }: PageProps<"/[locale]/insights">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const { insights } = dict;
  const articles = visibleArticles();
  const dateFormat = new Intl.DateTimeFormat(htmlLang[locale], { dateStyle: "long", timeZone: "UTC" });

  return (
    <>
      <PageHero {...insights.hero} />
      <section className="surface-white py-16 sm:py-24" aria-labelledby="topics-title">
        <Container className="grid gap-14 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <h2 id="topics-title" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {insights.topicsTitle}
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2 lg:flex-col lg:items-start">
              {Object.values(insights.topics).map((topic) => (
                <li key={topic}>
                  <Badge>{topic}</Badge>
                </li>
              ))}
            </ul>
          </aside>

          <div className="lg:col-span-9">
            {articles.length === 0 ? (
              <div className="rounded-sm border border-dashed border-slate p-10 sm:p-14">
                <h2 className="text-2xl font-semibold text-ink">{insights.empty.title}</h2>
                <p className="mt-3 max-w-xl leading-relaxed text-muted">{insights.empty.body}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {articles.map((article) => {
                  const a = article[locale];
                  return (
                    <li key={article.key}>
                      <Link
                        href={href(locale, "insights", articleSlugs[article.key][locale])}
                        className="group grid gap-3 py-10 sm:grid-cols-[1fr_auto] sm:gap-10"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                            <span className="font-semibold uppercase tracking-[0.18em]">{insights.topics[article.topic]}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {article.readingMinutes} {insights.readingTime}
                            </span>
                            {article.date ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <time dateTime={article.date}>{dateFormat.format(new Date(article.date))}</time>
                              </>
                            ) : null}
                            {article.status === "draft" ? <Badge>{insights.draftBadge}</Badge> : null}
                          </div>
                          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink group-hover:underline group-hover:decoration-champagne group-hover:underline-offset-8">
                            {a.title}
                          </h2>
                          <p className="mt-3 max-w-2xl leading-relaxed text-muted">{a.excerpt}</p>
                        </div>
                        <span className="inline-flex items-center gap-2 self-end text-sm font-semibold text-ink">
                          {dict.common.readArticle}
                          <ArrowIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
