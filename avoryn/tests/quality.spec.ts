import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ALL_PATHS } from "./fixtures";

/* ------------------------------------------------------------------------ */
/* Liens internes                                                             */
/* ------------------------------------------------------------------------ */

test("aucun lien interne cassé", async ({ page, request }) => {
  test.setTimeout(180_000);
  const links = new Set<string>();
  for (const path of ALL_PATHS) {
    await page.goto(path);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs) {
      if (href.startsWith("/")) links.add(href.split("#")[0]!);
    }
    // Les ancres internes (#...) doivent viser un élément existant.
    const anchors = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute("href")!.slice(1)));
    for (const id of anchors) {
      if (id) expect(await page.locator(`[id="${id}"]`).count(), `${path} #${id}`).toBeGreaterThan(0);
    }
  }
  const broken: string[] = [];
  for (const link of links) {
    const res = await request.get(link);
    if (res.status() >= 400) broken.push(`${link} → ${res.status()}`);
  }
  expect(broken).toEqual([]);
  expect(links.size).toBeGreaterThan(20);
});

/* ------------------------------------------------------------------------ */
/* Accessibilité                                                              */
/* ------------------------------------------------------------------------ */

test.describe("Accessibilité (axe, WCAG 2.2 AA)", () => {
  for (const path of ALL_PATHS) {
    test(path, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path, { waitUntil: "networkidle" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const summary = results.violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`,
      );
      expect(summary).toEqual([]);
    });
  }

  test("formulaire en erreur accessible", async ({ page }) => {
    await page.goto("/fr/contact");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.locator('[role="alert"][id$="-summary"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */
/* Tailles d'écran                                                            */
/* ------------------------------------------------------------------------ */

const VIEWPORTS = [
  { name: "mobile", width: 360, height: 780 },
  { name: "tablette", width: 768, height: 1024 },
  { name: "portable", width: 1024, height: 768 },
  { name: "bureau", width: 1440, height: 900 },
];

test.describe("Responsive : aucun débordement horizontal", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}px)`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const overflowing: string[] = [];
      for (const path of ALL_PATHS) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) overflowing.push(`${path} (+${overflow}px)`);
      }
      expect(overflowing).toEqual([]);
    });
  }
});

test("menu mobile : ouverture, navigation au clavier, fermeture par Échap", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/fr");
  const button = page.getByRole("button", { name: "Ouvrir le menu" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await button.click();
  const close = page.getByRole("button", { name: "Fermer le menu" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("header").getByRole("link", { name: "Solutions" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toBeFocused();
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page.locator("header").getByRole("link", { name: "Secteurs" }).click();
  await expect(page).toHaveURL(/\/fr\/secteurs$/);
  await expect(page.getByRole("button", { name: "Ouvrir le menu" })).toHaveAttribute("aria-expanded", "false");
});

test("lien d'évitement vers le contenu principal", async ({ page }) => {
  await page.goto("/fr");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu principal" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

/* ------------------------------------------------------------------------ */
/* SEO et sécurité                                                            */
/* ------------------------------------------------------------------------ */

test("robots.txt bloque l'indexation avant la mise en ligne", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toContain("Disallow: /");
});

test("sitemap.xml : pages bilingues avec hreflang, sans brouillons", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain("/fr/a-propos</loc>");
  expect(xml).toContain("/en/about</loc>");
  expect(xml).toContain("/fr/secteurs/marches-publics</loc>");
  expect(xml).toContain('hreflang="en-CA"');
  expect(xml).not.toContain("perspectives/commencer");
  expect(xml).not.toContain("/identite");
});

test("données structurées JSON-LD valides", async ({ page }) => {
  await page.goto("/fr");
  const blocks = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((e) => e.textContent ?? ""));
  expect(blocks.length).toBeGreaterThan(0);
  const data = JSON.parse(blocks[0]!);
  const org = data["@graph"].find((n: { "@type": string }) => n["@type"] === "Organization");
  expect(org.name).toBe("AVORYN");
  expect(org.slogan).toBe("L’ambition de créer. La vision de durer.");
});

test("image Open Graph générée", async ({ request }) => {
  const res = await request.get("/fr/opengraph-image");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("en-têtes de sécurité présents", async ({ request }) => {
  const res = await request.get("/fr");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("form-action 'self'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("aucune ressource tierce chargée", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.hostname !== "localhost") external.push(req.url());
  });
  await page.goto("/fr", { waitUntil: "networkidle" });
  expect(external).toEqual([]);
});
