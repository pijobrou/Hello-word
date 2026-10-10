/**
 * Articles de la section Perspectives.
 *
 * Tous les articles sont en statut « draft » : ils ne sont ni listés, ni générés,
 * ni indexés en production tant que NEXT_PUBLIC_SHOW_DRAFTS n'est pas activé.
 * Pour publier : relire, passer `status` à "published" et renseigner `date` (AAAA-MM-JJ).
 * Les articles ne contiennent volontairement aucune statistique ni actualité.
 */
import type { Locale } from "@/lib/i18n";
import { site } from "@/lib/site";
import { articleSlugs, type ArticleKey } from "@/lib/slugs";
import type { Dictionary } from "./fr";

type TopicKey = keyof Dictionary["insights"]["topics"];

type Section = { heading?: string; paragraphs: string[]; list?: string[] };
type LocalizedArticle = { title: string; excerpt: string; sections: Section[] };

export type Article = {
  key: ArticleKey;
  topic: TopicKey;
  status: "draft" | "published";
  /** Date de publication ISO (AAAA-MM-JJ), requise pour publier. */
  date: string | null;
  readingMinutes: number;
} & Record<Locale, LocalizedArticle>;

const articles: Article[] = [
  {
    key: "processFirst",
    topic: "digital",
    status: "draft",
    date: null,
    readingMinutes: 4,
    fr: {
      title: "Avant d’automatiser, comprendre le processus",
      excerpt:
        "Automatiser un processus mal compris revient souvent à accélérer ses défauts. Pourquoi l’analyse doit précéder l’outil.",
      sections: [
        {
          paragraphs: [
            "Face à une tâche répétitive, le réflexe est souvent de chercher un outil capable de l’automatiser. Le réflexe est sain ; l’ordre des étapes l’est moins.",
            "Un processus qui comporte des étapes inutiles, des responsabilités floues ou des exceptions non documentées ne s’améliore pas en étant automatisé. Il devient simplement plus rapide — et ses erreurs aussi.",
          ],
        },
        {
          heading: "Trois questions à se poser d’abord",
          paragraphs: ["Avant de choisir une technologie, quelques questions simples clarifient l’essentiel :"],
          list: [
            "Chaque étape est-elle réellement nécessaire, et pour qui ?",
            "Qui décide, qui exécute, qui contrôle ?",
            "Que se passe-t-il lorsque la situation sort de l’ordinaire ?",
          ],
        },
        {
          heading: "Simplifier, puis automatiser",
          paragraphs: [
            "Une fois le processus décrit et simplifié, l’automatisation devient plus fiable, moins coûteuse et plus facile à maintenir. Elle porte sur des étapes stables, dont les règles sont connues.",
            "C’est aussi le moment de décider ce qui doit rester humain : les jugements, les cas particuliers, la relation avec le client.",
          ],
        },
        {
          heading: "En résumé",
          paragraphs: [
            "L’outil vient en dernier. Comprendre, simplifier, puis automatiser : cet ordre protège l’investissement et la qualité du travail.",
          ],
        },
      ],
    },
    en: {
      title: "Before you automate, understand the process",
      excerpt:
        "Automating a poorly understood process often just speeds up its flaws. Why analysis should come before the tool.",
      sections: [
        {
          paragraphs: [
            "Faced with a repetitive task, the instinct is often to look for a tool that can automate it. The instinct is sound; the order of operations is not.",
            "A process with unnecessary steps, unclear responsibilities or undocumented exceptions does not get better when it is automated. It simply gets faster — and so do its mistakes.",
          ],
        },
        {
          heading: "Three questions to ask first",
          paragraphs: ["Before choosing a technology, a few simple questions clarify what matters:"],
          list: [
            "Is every step truly necessary, and for whom?",
            "Who decides, who does the work, who checks it?",
            "What happens when the situation is out of the ordinary?",
          ],
        },
        {
          heading: "Simplify, then automate",
          paragraphs: [
            "Once the process is described and simplified, automation becomes more reliable, less costly and easier to maintain. It applies to stable steps with known rules.",
            "This is also the moment to decide what should stay human: judgment calls, special cases and the client relationship.",
          ],
        },
        {
          heading: "In short",
          paragraphs: [
            "The tool comes last. Understand, simplify, then automate: that order protects both the investment and the quality of the work.",
          ],
        },
      ],
    },
  },
  {
    key: "aiGuardrails",
    topic: "ai",
    status: "draft",
    date: null,
    readingMinutes: 4,
    fr: {
      title: "IA appliquée : commencer par le cadre",
      excerpt:
        "L’intelligence artificielle est utile lorsqu’elle est encadrée. Quelques principes pour l’adopter avec prudence et efficacité.",
      sections: [
        {
          paragraphs: [
            "Les outils d’intelligence artificielle sont devenus accessibles à toutes les organisations. La question n’est plus de savoir s’ils sont utiles, mais comment les utiliser de façon responsable.",
          ],
        },
        {
          heading: "Choisir des cas d’usage précis",
          paragraphs: [
            "Les meilleurs résultats viennent de tâches bien délimitées : résumer un document, classer des demandes, extraire des informations. Un objectif précis permet de mesurer si l’outil apporte réellement quelque chose.",
          ],
        },
        {
          heading: "Protéger les renseignements",
          paragraphs: [
            "Avant d’envoyer des données à un service d’IA, il faut savoir où elles sont traitées, si elles sont conservées et à quelles fins. Au Québec, la Loi 25 impose notamment d’évaluer les risques avant de communiquer des renseignements personnels à l’extérieur de la province.",
          ],
        },
        {
          heading: "Garder l’humain dans la boucle",
          paragraphs: ["Un cadre simple suffit souvent pour commencer :"],
          list: [
            "des usages autorisés et des usages interdits, écrits noir sur blanc;",
            "une validation humaine pour toute décision qui touche une personne ou un engagement;",
            "une vérification régulière de la qualité des résultats.",
          ],
        },
        {
          heading: "En résumé",
          paragraphs: [
            "L’IA appliquée crée de la valeur lorsqu’elle répond à un besoin précis, dans un cadre clair. Le cadre ne freine pas l’adoption : il la rend durable.",
          ],
        },
      ],
    },
    en: {
      title: "Applied AI: start with the framework",
      excerpt:
        "Artificial intelligence is useful when it is governed. A few principles for adopting it carefully and effectively.",
      sections: [
        {
          paragraphs: [
            "AI tools are now within reach of every organization. The question is no longer whether they are useful, but how to use them responsibly.",
          ],
        },
        {
          heading: "Choose specific use cases",
          paragraphs: [
            "The best results come from well-defined tasks: summarizing a document, triaging requests, extracting information. A specific goal makes it possible to measure whether the tool actually adds value.",
          ],
        },
        {
          heading: "Protect information",
          paragraphs: [
            "Before sending data to an AI service, you need to know where it is processed, whether it is retained and for what purpose. In Québec, Law 25 notably requires assessing the risks before disclosing personal information outside the province.",
          ],
        },
        {
          heading: "Keep people in the loop",
          paragraphs: ["A simple framework is often enough to get started:"],
          list: [
            "permitted and prohibited uses, written down;",
            "human review of any decision affecting a person or a commitment;",
            "regular checks on the quality of results.",
          ],
        },
        {
          heading: "In short",
          paragraphs: [
            "Applied AI creates value when it meets a specific need within a clear framework. The framework does not slow adoption — it makes it last.",
          ],
        },
      ],
    },
  },
  {
    key: "decisionDashboards",
    topic: "finance",
    status: "draft",
    date: null,
    readingMinutes: 3,
    fr: {
      title: "Des tableaux de bord qui servent vraiment à décider",
      excerpt:
        "Un bon tableau de bord ne montre pas tout : il montre ce qui aide à décider. Comment le concevoir.",
      sections: [
        {
          paragraphs: [
            "Beaucoup de tableaux de bord sont consultés une fois, puis oubliés. Ils affichent beaucoup de chiffres, mais répondent mal aux questions que l’on se pose réellement.",
          ],
        },
        {
          heading: "Partir des décisions",
          paragraphs: [
            "La bonne question n’est pas « quelles données avons-nous ? », mais « quelles décisions devons-nous prendre, et à quel rythme ? ». Chaque indicateur doit pouvoir être relié à une décision.",
          ],
        },
        {
          heading: "Fiabiliser avant d’afficher",
          paragraphs: [
            "Un indicateur mal défini ou alimenté par des données incomplètes fait plus de tort qu’il n’aide. Définir précisément chaque mesure et sa source est un travail préalable indispensable.",
          ],
        },
        {
          heading: "Adapter la vue au rôle",
          paragraphs: [
            "La direction, les gestionnaires et les équipes n’ont pas besoin des mêmes informations. Quelques vues ciblées valent mieux qu’un écran unique surchargé.",
          ],
        },
      ],
    },
    en: {
      title: "Dashboards that actually support decisions",
      excerpt: "A good dashboard doesn’t show everything — it shows what helps you decide. Here is how to design one.",
      sections: [
        {
          paragraphs: [
            "Many dashboards are looked at once and then forgotten. They display plenty of numbers but do a poor job of answering the questions people actually ask.",
          ],
        },
        {
          heading: "Start from decisions",
          paragraphs: [
            "The right question is not “what data do we have?” but “what decisions do we need to make, and how often?” Every indicator should be traceable to a decision.",
          ],
        },
        {
          heading: "Make data reliable before displaying it",
          paragraphs: [
            "A poorly defined indicator, or one fed by incomplete data, does more harm than good. Precisely defining each measure and its source is essential groundwork.",
          ],
        },
        {
          heading: "Tailor the view to the role",
          paragraphs: [
            "Leadership, managers and teams do not need the same information. A few targeted views are better than one overloaded screen.",
          ],
        },
      ],
    },
  },
];

/** Articles visibles : publiés, ou brouillons lorsque le mode révision est actif. */
export function visibleArticles(): Article[] {
  return articles
    .filter((a) => a.status === "published" || site.showDrafts)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function findArticle(locale: Locale, slug: string): Article | undefined {
  return visibleArticles().find((a) => articleSlugs[a.key][locale] === slug);
}
