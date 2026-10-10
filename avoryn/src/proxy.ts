import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n";

/** Choisit la langue préférée du navigateur entre fr et en (fr par défaut). */
function preferredLocale(request: NextRequest): Locale {
  const header = request.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);
  const match = ranked.find((entry) => isLocale(entry.lang));
  return match && isLocale(match.lang) ? match.lang : defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Ignore les ressources internes, les fichiers statiques et les fichiers SEO générés.
  matcher: ["/((?!_next|api|brand|images|favicon.ico|icon|apple-icon|sitemap.xml|robots.txt|.*\\..*).*)"],
};
