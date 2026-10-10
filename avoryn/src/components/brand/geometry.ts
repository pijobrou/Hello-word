/**
 * Géométrie du logo AVORYN (proposition provisoire, à valider).
 * Source unique utilisée par les composants React et par le script
 * scripts/generate-brand.ts qui produit les fichiers de public/brand.
 *
 * Symbole : un octogone élargi — un œil, la vision — dans lequel deux traits
 * convergent (la création) vers un axe vertical (la progression), posé
 * au-dessus de la base (la stabilité).
 */

export const SYMBOL = {
  width: 108,
  height: 68,
  viewBox: "-4 -4 108 68",
  strokeWidth: 3.6,
  frame: "0,30 18,10 50,0 82,10 100,30 82,50 50,60 18,50",
  core: "M31 20 L50 39 L69 20 M50 39 L50 51.5",
} as const;

/**
 * Logotype : capitales géométriques dessinées au trait, coupées par la bande
 * de hauteur de capitale (le débord des onglets est masqué par le viewport),
 * ce qui donne des terminaisons horizontales nettes.
 * Le O reprend l'octogone du symbole.
 */
export const WORDMARK = {
  width: 257,
  height: 45,
  viewBox: "-3 -2.5 257 45",
  strokeWidth: 5,
  letters: [
    // A
    "M0 46 L16 -12 L32 46 M7.5 27 H24.5",
    // V
    "M44 -6 L60 52 L76 -6",
    // O (octogone)
    "M99 0 H113 L124 11 V29 L113 40 H99 L88 29 V11 Z",
    // R
    "M136 46 V0 H157 L165 8 V15 L158 22 L171 46 M158 22 H136",
    // Y
    "M181 -6 L196 20 L211 -6 M196 20 V46",
    // N
    "M223 46 V0 L251 40 V-6",
  ],
} as const;

export const BRAND_COLORS = {
  night: "#101C2D",
  champagne: "#C8A96D",
  white: "#FFFFFF",
} as const;
