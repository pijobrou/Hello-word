import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Avant la mise en ligne officielle, aucun robot n'indexe le site.
  if (!site.allowIndexing) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/fr/identite", "/en/brand"] },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
