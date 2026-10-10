import { expect, test } from "@playwright/test";
import { ALL_PATHS } from "./fixtures";

test.describe("Pages", () => {
  for (const path of ALL_PATHS) {
    test(`${path} — 200, titre, langue, hreflang, console propre`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") problems.push(`${msg.type()}: ${msg.text()}`);
      });
      page.on("pageerror", (err) => problems.push(`pageerror: ${err.message}`));

      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toBeVisible();

      const lang = path.startsWith("/en") ? "en-CA" : "fr-CA";
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page).toHaveTitle(/AVORYN/);
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();

      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(canonical?.endsWith(path)).toBe(true);
      await expect(page.locator('link[rel="alternate"][hreflang="fr-CA"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en-CA"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);

      expect(problems).toEqual([]);
    });
  }
});

test.describe("Redirections et langues", () => {
  test("la racine redirige vers /fr par défaut", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0, headers: { "accept-language": "fr-CA,fr;q=0.9" } });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toMatch(/\/fr$/);
  });

  test("la racine redirige vers /en pour un navigateur anglophone", async ({ request }) => {
    const res = await request.get("/", { maxRedirects: 0, headers: { "accept-language": "en-CA,en;q=0.9" } });
    expect(res.headers().location).toMatch(/\/en$/);
  });

  test("un chemin sans langue reçoit le préfixe", async ({ request }) => {
    const res = await request.get("/contact", { maxRedirects: 0, headers: { "accept-language": "fr" } });
    expect(res.headers().location).toMatch(/\/fr\/contact$/);
  });

  test("le segment anglais sous /fr redirige vers le segment français", async ({ request }) => {
    const res = await request.get("/fr/about", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers().location).toBe("/fr/a-propos");
  });

  test("le sélecteur de langue conserve la page (fiche secteur)", async ({ page }) => {
    await page.goto("/fr/secteurs/immobilier");
    await page.getByRole("link", { name: "Read this page in English" }).first().click();
    await expect(page).toHaveURL(/\/en\/sectors\/real-estate$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
    await page.getByRole("link", { name: "Lire cette page en français" }).first().click();
    await expect(page).toHaveURL(/\/fr\/secteurs\/immobilier$/);
  });

  test("une page inconnue renvoie une 404 localisée", async ({ page }) => {
    const res = await page.goto("/en/does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("This page could not be found.");
    const resFr = await page.goto("/fr/secteurs/inexistant");
    expect(resFr?.status()).toBe(404);
    await expect(page.locator("h1")).toHaveText("Cette page est introuvable.");
  });

  test("les brouillons d'articles ne sont pas publiés", async ({ request }) => {
    const res = await request.get("/fr/perspectives/commencer-par-le-processus");
    expect(res.status()).toBe(404);
  });
});
