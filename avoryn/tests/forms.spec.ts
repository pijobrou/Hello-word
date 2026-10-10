import { expect, test, type Page } from "@playwright/test";
import { looksAutomated, MIN_FILL_TIME_MS, validate, type Values } from "../src/lib/contact";

/* ------------------------------------------------------------------------ */
/* Validation (logique pure)                                                  */
/* ------------------------------------------------------------------------ */

const valid: Values = {
  type: "project",
  name: "Jeanne Test",
  email: "jeanne@example.com",
  organization: "",
  sector: "realEstate",
  message: "Nous souhaitons automatiser le suivi de nos baux.",
  consent: true,
};

test.describe("validate()", () => {
  test("accepte une demande valide", () => {
    expect(validate(valid).ok).toBe(true);
  });

  test("signale chaque champ invalide", () => {
    const result = validate({
      type: "autre",
      name: "",
      email: "pas-un-courriel",
      organization: "x".repeat(200),
      sector: "inconnu",
      message: "court",
      consent: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        type: "typeInvalid",
        name: "nameRequired",
        email: "emailInvalid",
        organization: "organizationTooLong",
        sector: "sectorInvalid",
        message: "messageTooShort",
        consent: "consentRequired",
      });
    }
  });

  test("limite la longueur du message", () => {
    const result = validate({ ...valid, message: "a".repeat(4001) });
    expect(result.ok || result.errors.message).toBe("messageTooLong");
  });

  test("le secteur vide devient « other »", () => {
    const result = validate({ ...valid, sector: "" });
    expect(result.ok && result.data.sector).toBe("other");
  });
});

test.describe("looksAutomated()", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const now = 1_000_000_000;

  test("pot de miel rempli", () => {
    expect(looksAutomated(form({ website: "spam.example", startedAt: String(now - 10_000) }), now)).toBe(true);
  });
  test("envoi trop rapide", () => {
    expect(looksAutomated(form({ startedAt: String(now - MIN_FILL_TIME_MS + 100) }), now)).toBe(true);
  });
  test("horodatage invalide", () => {
    expect(looksAutomated(form({ startedAt: "abc" }), now)).toBe(true);
  });
  test("message rempli de liens", () => {
    const message = "http://a.example http://b.example http://c.example http://d.example";
    expect(looksAutomated(form({ startedAt: String(now - 10_000), message }), now)).toBe(true);
  });
  test("envoi humain normal", () => {
    expect(looksAutomated(form({ startedAt: String(now - 10_000), message: "Bonjour" }), now)).toBe(false);
  });
  test("sans JavaScript (pas d'horodatage), seules les autres protections s'appliquent", () => {
    expect(looksAutomated(form({ message: "Bonjour" }), now)).toBe(false);
  });
});

/* ------------------------------------------------------------------------ */
/* Parcours dans le navigateur                                                */
/* ------------------------------------------------------------------------ */

async function fillValid(page: Page, { withSector = true } = {}) {
  await page.getByLabel("Nom complet").fill("Jeanne Test");
  await page.getByLabel("Adresse courriel").fill("jeanne@example.com");
  if (withSector) await page.getByLabel(/^Secteur/).selectOption("ecommerce");
  await page.getByLabel("Description du besoin").fill("Nous voulons connecter notre boutique à notre comptabilité.");
  await page.getByRole("checkbox").check();
}

test.describe("Formulaire de contact", () => {
  test("affiche les erreurs, les associe aux champs et met le focus sur le résumé", async ({ page }) => {
    await page.goto("/fr/contact");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    const alert = page.locator('[role="alert"][id$="-summary"]');
    await expect(alert).toBeFocused();
    await expect(alert).toContainText("Veuillez indiquer votre nom.");
    await expect(alert).toContainText("Votre consentement est nécessaire");
    const name = page.getByLabel("Nom complet");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription("Veuillez indiquer votre nom.");
  });

  test("conserve les valeurs saisies après une erreur", async ({ page }) => {
    await page.goto("/fr/contact");
    await page.getByLabel("Nom complet").fill("Jeanne Test");
    await page.getByLabel("Adresse courriel").fill("invalide");
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.locator('[role="alert"][id$="-summary"]')).toContainText("adresse courriel valide");
    await expect(page.getByLabel("Nom complet")).toHaveValue("Jeanne Test");
    await expect(page.getByLabel("Adresse courriel")).toHaveValue("invalide");
  });

  test("envoie une demande valide et confirme la réception", async ({ page }) => {
    await page.goto("/fr/contact");
    await fillValid(page);
    await page.waitForTimeout(MIN_FILL_TIME_MS + 300);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("Merci, votre demande a bien été reçue.");
    await expect(status).toBeFocused();
  });

  test("rejette un envoi trop rapide (protection anti-robot)", async ({ page }) => {
    await page.goto("/fr/contact");
    await fillValid(page);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.locator('[role="alert"][id$="-summary"]')).toContainText("n’a pas pu être envoyée");
  });

  test("rejette un envoi dont le pot de miel est rempli", async ({ page }) => {
    await page.goto("/fr/contact");
    await fillValid(page);
    await page.locator('input[name="website"]').fill("http://spam.example", { force: true });
    await page.waitForTimeout(MIN_FILL_TIME_MS + 300);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.locator('[role="alert"][id$="-summary"]')).toContainText("n’a pas pu être envoyée");
  });

  test("présélectionne le type de demande depuis l'URL", async ({ page }) => {
    await page.goto("/fr/contact?type=partnership");
    await expect(page.getByRole("radio", { name: "Demande de partenariat" })).toBeChecked();
  });

  test("fiche secteur : secteur imposé et demande de projet", async ({ page }) => {
    await page.goto("/fr/secteurs/marches-publics");
    await expect(page.locator('input[type="hidden"][name="sector"]')).toHaveValue("publicProcurement");
    await expect(page.getByRole("radio", { name: "Demande de projet" })).toBeChecked();
    await fillValid(page, { withSector: false });
    await page.waitForTimeout(MIN_FILL_TIME_MS + 300);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByRole("status")).toContainText("Merci");
  });

  test("version anglaise : messages traduits", async ({ page }) => {
    await page.goto("/en/contact");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.locator('[role="alert"][id$="-summary"]')).toContainText("Please enter your name.");
    await expect(page.locator('[role="alert"][id$="-summary"]')).toContainText("Your consent is required");
  });
});
