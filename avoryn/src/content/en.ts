/**
 * Canadian English content for the AVORYN website.
 * Must match the structure of fr.ts (Dictionary type).
 * The English tagline is a marketing adaptation pending approval.
 */
import type { Dictionary } from "./fr";

export const en: Dictionary = {
  meta: {
    siteName: "AVORYN",
    slogan: "Driven to Create. Built to Last.",
    positioning: "Technology, innovation and business solutions",
    description:
      "AVORYN is a Canadian entrepreneurial brand focused on technology, innovation and business solutions — combining business analysis, automation and intelligent technology for organizations.",
  },

  pages: {
    home: {
      title: "AVORYN — Technology, innovation and business solutions",
      description:
        "Intelligent solutions for tomorrow’s ambitions. AVORYN combines business expertise, technology and innovation to help organizations simplify their operations.",
    },
    about: {
      title: "About",
      description: "Why AVORYN exists: our story, mission, values, founder and long-term vision.",
    },
    solutions: {
      title: "Business solutions",
      description:
        "Business needs analysis, process assessment, administrative optimization, digital integration, workflow automation and dashboards.",
    },
    technologies: {
      title: "Technology and innovation",
      description:
        "Intelligent automation, applied AI, API integration, governed AI agents, software design, SaaS and systems modernization.",
    },
    sectors: {
      title: "Industries",
      description:
        "Professional services, accounting and administration, human resources, real estate, e-commerce and public procurement.",
    },
    innovations: {
      title: "Innovation and projects",
      description: "AVORYN’s entrepreneurial and technology initiatives, each shown with its actual stage of progress.",
    },
    method: {
      title: "Our method",
      description: "Understand, analyze, design, deploy, improve: AVORYN’s five-step approach.",
    },
    insights: {
      title: "Insights",
      description: "Analysis and perspectives on digital transformation, artificial intelligence, productivity and entrepreneurship.",
    },
    contact: {
      title: "Contact",
      description: "Discuss your project with AVORYN: project request, partnership proposal or general enquiry.",
    },
    privacy: {
      title: "Privacy policy",
      description: "How AVORYN collects, uses and protects personal information (Québec Law 25).",
    },
    brand: {
      title: "Brand identity",
      description: "AVORYN logo, colours and typography — provisional proposal.",
    },
    notFound: {
      title: "Page not found",
      description: "The page you are looking for does not exist or has moved.",
    },
  },

  nav: {
    home: "Home",
    about: "About",
    solutions: "Solutions",
    technologies: "Technology",
    sectors: "Industries",
    innovations: "Innovation",
    method: "Our method",
    insights: "Insights",
    contact: "Contact",
    primary: "Main navigation",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    skip: "Skip to main content",
    switchLabel: "FR",
    switchTitle: "Lire cette page en français",
    homeLabel: "AVORYN — Home",
    breadcrumb: "Breadcrumb",
  },

  common: {
    discoverSolutions: "Explore our solutions",
    discussProject: "Discuss your project",
    learnMore: "Learn more",
    readArticle: "Read the article",
    allSectors: "All industries",
    stepLabel: "Step",
    status: "Status",
    toBeConfirmed: "To be confirmed",
  },

  footer: {
    summary: "A Canadian entrepreneurial brand in development — technology, innovation and business solutions.",
    explore: "Explore",
    company: "Company",
    information: "Information",
    privacy: "Privacy policy",
    brand: "Brand identity",
    contactCta: "Write to us through the form",
    rights: "All rights reserved.",
    origin: "Designed in Québec, Canada.",
  },

  home: {
    hero: {
      eyebrow: "Technology · Innovation · Business solutions",
      title: "Intelligent solutions for tomorrow’s ambitions.",
      subtitle:
        "We combine business expertise, technology and innovation to help organizations simplify their operations and create lasting value.",
    },
    intro: {
      eyebrow: "Overview",
      title: "A brand built to connect business and technology.",
      body: [
        "AVORYN is a Canadian entrepreneurial brand in development. It supports businesses and organizations by combining business analysis, operational expertise and intelligent technology.",
        "We never start with the tool. We start by understanding how an organization actually works — its constraints and its goals.",
      ],
      facts: [
        { label: "Based in", value: "Québec, Canada" },
        { label: "Languages", value: "English · Français" },
        { label: "Principle", value: "Business first, technology second" },
      ],
    },
    vision: {
      eyebrow: "Our vision",
      title: "Building a brand that lasts.",
      body: "To design, develop and deploy solutions that meet the economic and technological challenges businesses face.",
      horizons: [
        { label: "Today", text: "Analysis, guidance and solution integration for organizations." },
        { label: "Next", text: "Designing reusable digital systems and automations." },
        { label: "Long term", text: "Building our own software products and new lines of business." },
      ],
    },
    challenges: {
      eyebrow: "The challenges we solve",
      title: "Where organizations lose time and clarity.",
      items: [
        {
          title: "Manual, repetitive processes",
          body: "Double data entry, scattered files and tasks that depend on a single person.",
        },
        {
          title: "Tools that don’t talk to each other",
          body: "Useful but isolated software that forces people to copy information from one system to another.",
        },
        {
          title: "Information that is hard to use",
          body: "The data exists, but it is unreliable or hard to read when a decision has to be made.",
        },
        {
          title: "Administration slowing growth",
          body: "An administrative workload that grows faster than the business itself.",
        },
        {
          title: "AI without a framework",
          body: "Genuine interest in AI, but no clear priorities, usage rules or way to measure results.",
        },
        {
          title: "Poorly scoped digital projects",
          body: "Initiatives launched without a prior assessment that end up costing more than they return.",
        },
      ],
    },
    expertise: {
      eyebrow: "Our expertise",
      title: "Three complementary areas of expertise.",
      items: [
        {
          route: "solutions",
          title: "Business solutions",
          body: "Needs analysis, process assessment, administrative optimization and decision support.",
          cta: "View solutions",
        },
        {
          route: "technologies",
          title: "Technology and innovation",
          body: "Intelligent automation, applied AI, API integration and software design.",
          cta: "View technology",
        },
        {
          route: "sectors",
          title: "Industry knowledge",
          body: "Hands-on understanding of professional services, administration, recruitment, real estate, e-commerce and public procurement.",
          cta: "View industries",
        },
      ],
    },
    method: {
      eyebrow: "Our method",
      title: "A five-step approach.",
      body: "Every engagement follows the same discipline: understand before proposing, measure before automating.",
      cta: "Explore the method",
    },
    technologies: {
      eyebrow: "Our technology",
      title: "Technology chosen for its usefulness.",
      body: "We select tools based on the problem to solve, their reliability and their total cost — not their popularity.",
      items: [
        "Workflow automation",
        "Applied artificial intelligence",
        "API integrations",
        "Governed AI agents",
        "Dashboards",
        "Web applications and SaaS",
      ],
      cta: "Explore our technology",
    },
    sectors: {
      eyebrow: "Our industries",
      title: "Industries we know from the inside.",
      body: "These industries are tied to the founder’s background and draw on first-hand experience of their day-to-day realities.",
    },
    founder: {
      eyebrow: "The founder",
      title: "An entrepreneurial approach.",
      body: "A multidisciplinary entrepreneur based in Québec with a bachelor’s degree in accounting and taxation, AVORYN’s founder has worked across administration, professional services, healthcare, recruitment, e-commerce and technology projects.",
      cta: "Read the founder’s story",
    },
    contact: {
      eyebrow: "Contact and consultation",
      title: "Let’s talk about your next project.",
      body: "Describe your situation in a few lines. We will get back to you to arrange an initial conversation, with no obligation.",
      primary: "Discuss your project",
      secondary: "Propose a partnership",
    },
  },

  method: {
    steps: [
      {
        title: "Understand",
        summary: "Listen, observe and clarify objectives.",
        body: "We begin by understanding the organization, its priorities, its constraints and the people involved.",
        outputs: ["Scoping interviews", "Objectives and success criteria", "Engagement scope"],
      },
      {
        title: "Analyze",
        summary: "Map processes and measure.",
        body: "We document how things work today, identify pain points and estimate the potential for improvement.",
        outputs: ["Process maps", "Prioritized assessment", "Cost-benefit analysis"],
      },
      {
        title: "Design",
        summary: "Find the simplest solution that works.",
        body: "We design a proportionate solution: reorganization, an existing tool, an integration or custom development.",
        outputs: ["Solution architecture", "Mock-ups or prototype", "Implementation plan"],
      },
      {
        title: "Deploy",
        summary: "Roll out step by step.",
        body: "We deploy in stages, with testing, documentation and support for users.",
        outputs: ["Phased go-live", "Documentation", "Knowledge transfer"],
      },
      {
        title: "Improve",
        summary: "Measure results and adjust.",
        body: "We track the agreed indicators and refine the solution as the organization evolves.",
        outputs: ["Indicator tracking", "Adjustments", "Recommendations for next steps"],
      },
    ],
    page: {
      eyebrow: "Our method",
      title: "Understand before you build.",
      intro: "A structured five-step approach designed to reduce risk and deliver measurable results.",
      outputsLabel: "Typical deliverables",
      cycleTitle: "A cycle, not a straight line",
      cycleBody: "The fifth step feeds the first: every measured improvement opens a new cycle of understanding.",
      principlesTitle: "Our principles",
      principles: [
        { title: "Proportionality", body: "The solution fits the problem — never the other way around." },
        { title: "Progression", body: "Short steps validated one at a time, rather than one big risky leap." },
        { title: "Measurement", body: "Success criteria defined from the outset and tracked over time." },
        { title: "Knowledge transfer", body: "Clear documentation so the organization stays self-sufficient." },
      ],
    },
  },

  about: {
    hero: {
      eyebrow: "About",
      title: "Why AVORYN exists.",
      intro: "Many organizations have powerful tools but lack an approach that connects their business realities with technology. AVORYN was created to fill that gap.",
    },
    story: {
      title: "Our story",
      body: [
        "AVORYN builds on an entrepreneurial journey rooted in Québec, spanning accounting, administration, professional services, recruitment, e-commerce and technology projects.",
        "Across these experiences, one observation kept coming back: organizations’ difficulties are rarely purely technical. They sit where processes, information and tools meet.",
        "AVORYN was created to work at that intersection, with rigour and for the long term. The brand is in its early days and is being built one step at a time.",
      ],
    },
    ambition: {
      title: "Our ambition",
      body: "To become a leading Canadian brand in technology and business solutions — one that supports organizations, designs its own products and, in time, welcomes new lines of business.",
    },
    mission: {
      title: "Our mission",
      body: "To support businesses and organizations in their growth by combining business analysis, operational expertise and intelligent technology.",
    },
    vision: {
      title: "Our vision",
      body: "To build a lasting brand that designs, develops and deploys solutions to the economic and technological challenges businesses face.",
    },
    values: {
      eyebrow: "Our values",
      title: "Six commitments.",
      items: [
        { title: "Innovation", body: "Looking for better ways of doing things, without chasing trends." },
        { title: "Excellence", body: "Taking care with every detail, from analysis to delivery." },
        { title: "Integrity", body: "Being clear about what we do well — and what we don’t do." },
        { title: "Reliability", body: "Delivering solutions that work every day, documented and maintainable." },
        { title: "Ambition", body: "Aiming high while moving forward methodically." },
        { title: "Long-term value", body: "Favouring lasting results over quick wins." },
      ],
    },
    founder: {
      eyebrow: "The founder",
      title: "A multidisciplinary background.",
      quote:
        "An entrepreneurial approach that connects organizational challenges, business understanding and technology to design lasting solutions.",
      body: [
        "An entrepreneur based in Québec, AVORYN’s founder holds a bachelor’s degree in accounting and taxation.",
        "A career spanning a wide range of environments has given AVORYN’s founder a cross-functional view of organizations: the numbers, the operations, the people and the tools.",
        "The founder’s focus: solving problems, building businesses and driving technological innovation.",
      ],
      journeyTitle: "Areas of experience",
      journey: [
        "Accounting and taxation",
        "Administration and professional services",
        "Healthcare sector",
        "Recruitment and staffing services",
        "E-commerce and Shopify",
        "AI automation projects",
        "SaaS software design",
        "Business model analysis",
        "Real estate and acquisition projects",
        "Public procurement",
      ],
      role: "Founder",
      nameFallback: "AVORYN’s founder",
      photoAlt: "Portrait of AVORYN’s founder",
    },
    approach: {
      eyebrow: "Our approach",
      title: "How we work.",
      items: [
        {
          title: "Business first",
          body: "Understanding the model, the flows and the priorities before recommending any technology.",
        },
        {
          title: "The right solution",
          body: "Choosing the simplest solution that meets the need, whether organizational or technological.",
        },
        { title: "Transparency", body: "Setting out options, costs, limitations and risks clearly." },
        {
          title: "Client autonomy",
          body: "Documenting and handing over so the organization stays in control of its tools.",
        },
      ],
    },
    longTerm: {
      eyebrow: "Our long-term vision",
      title: "A path in three stages.",
      body: "AVORYN is being built as a brand that can grow: first by supporting organizations, then by designing its own systems and software products. Each stage will be reached at the pace of verifiable results.",
    },
  },

  solutions: {
    hero: {
      eyebrow: "Business solutions",
      title: "Clarify, simplify, equip.",
      intro: "Targeted engagements to understand your needs, improve your processes and make better decisions.",
    },
    labels: { problems: "Problems addressed", deliverables: "Deliverables", method: "Method" },
    items: [
      {
        id: "needs-analysis",
        title: "Business needs analysis",
        summary: "Turning business objectives into clear, prioritized requirements.",
        problems: [
          "Needs expressed vaguely or inconsistently",
          "Projects launched without success criteria",
          "Difficulty choosing between several options",
        ],
        deliverables: ["Prioritized requirements document", "Measurable success criteria", "Options recommendation"],
        method: "Stakeholder interviews, document review and a prioritization workshop.",
      },
      {
        id: "process-assessment",
        title: "Process assessment",
        summary: "Understanding how work really gets done — and where it gets stuck.",
        problems: [
          "Recurring delays and errors",
          "Tasks that depend on a single person",
          "No overall view of operations",
        ],
        deliverables: ["Current-state process maps", "Prioritized list of pain points", "Improvement roadmap"],
        method: "Observation, workflow mapping and estimation of the related time and costs.",
      },
      {
        id: "administrative-optimization",
        title: "Administrative optimization",
        summary: "Lightening the administrative load without losing control.",
        problems: ["Double data entry", "Scattered filing and follow-ups", "Time-consuming manual checks"],
        deliverables: [
          "Simplified, documented processes",
          "Standardized templates",
          "Fit-for-purpose control procedures",
        ],
        method: "Reviewing each step, removing redundancies and standardizing progressively.",
      },
      {
        id: "digital-integration",
        title: "Digital solution integration",
        summary: "Choosing and connecting the right tools rather than adding more.",
        problems: [
          "Software that works in isolation",
          "Tools chosen without evaluation criteria",
          "Low adoption by teams",
        ],
        deliverables: ["Tool comparison matrix", "Integration plan", "Adoption support"],
        method: "Needs assessment, objective comparison of options and supervised implementation.",
      },
      {
        id: "workflow-automation",
        title: "Workflow automation",
        summary: "Automating repetitive tasks, with clear rules and human oversight.",
        problems: ["Repetitive, low-value tasks", "Manual information transfers", "Missed or late follow-ups"],
        deliverables: ["Documented automated workflows", "Exception-handling rules", "Monitoring indicators"],
        method: "Identifying automatable tasks, prototyping, testing, then a phased go-live.",
      },
      {
        id: "dashboards",
        title: "Dashboards and decision support",
        summary: "Making information readable when it is time to decide.",
        problems: [
          "Data spread across multiple files",
          "Reports produced by hand",
          "Unreliable or poorly defined indicators",
        ],
        deliverables: ["Key indicator definitions", "Dashboard connected to data sources", "Reading and user guide"],
        method: "Defining indicators, making data reliable, then designing views suited to each role.",
      },
    ],
    cta: {
      title: "Don’t see your need here?",
      body: "Every organization is different. Tell us about your situation and we will tell you honestly whether we can help.",
    },
  },

  technologies: {
    hero: {
      eyebrow: "Technology and innovation",
      title: "Technology in service of operations.",
      intro: "We draw on proven and emerging technology, always grounded in prior business analysis.",
    },
    notice: {
      title: "Where we stand",
      body: "AVORYN currently offers analysis, design and integration services. AVORYN’s own software products are being explored and are not yet commercially available.",
    },
    statusLabels: { service: "Offered as a service", exploration: "Under exploration" },
    labels: { uses: "Example uses", principle: "Our principle" },
    items: [
      {
        id: "intelligent-automation",
        status: "service",
        title: "Intelligent automation",
        summary: "Automating sequences of tasks by combining business rules with intelligent information processing.",
        uses: ["Processing forms and documents", "Automatic reminders and follow-ups", "Synchronizing tools"],
        principle: "Automate what is stable and well understood; keep human review wherever judgment is needed.",
      },
      {
        id: "applied-ai",
        status: "service",
        title: "Applied artificial intelligence",
        summary: "Using AI for specific tasks: sorting, summarizing, extracting and drafting.",
        uses: ["Extracting information from documents", "Triaging incoming requests", "Drafting and summarizing support"],
        principle: "Measurable use cases, protected data and verified results.",
      },
      {
        id: "api-integration",
        status: "service",
        title: "API integration",
        summary: "Connecting software so information flows without re-entry.",
        uses: [
          "Linking sales, operations and accounting tools",
          "Centralizing data",
          "Exchanging data with external platforms",
        ],
        principle: "Integrations that are documented, monitored and easy to maintain.",
      },
      {
        id: "ai-agents",
        status: "exploration",
        title: "Governed AI agents",
        summary: "Assistants that can chain actions together within a strictly defined scope.",
        uses: ["Preparing files for review", "Researching and summarizing information", "Assisting with request handling"],
        principle: "Limited permissions, full traceability and human approval of sensitive actions.",
      },
      {
        id: "software-design",
        status: "service",
        title: "Software design",
        summary: "Designing custom applications when existing tools fall short.",
        uses: ["Internal applications", "Client portals", "Specialized business tools"],
        principle: "Build custom only when justified, with maintainable, documented code.",
      },
      {
        id: "saas-development",
        status: "exploration",
        title: "SaaS development",
        summary: "Exploring online software products that address recurring needs observed in the field.",
        uses: ["Specialized administrative tools", "Solutions for targeted industries", "Reusable automation services"],
        principle: "Validate a real need before building a product.",
      },
      {
        id: "systems-modernization",
        status: "service",
        title: "Systems modernization",
        summary: "Moving ageing tools or critical files to more robust solutions.",
        uses: ["Migrating business-critical spreadsheets", "Replacing obsolete tools", "Consolidating systems"],
        principle: "Modernize in stages, without disrupting operations.",
      },
    ],
    responsible: {
      eyebrow: "Responsible AI",
      title: "A framework before the tool.",
      items: [
        "Privacy by design",
        "Human review of sensitive decisions",
        "Transparency about the limits of each tool",
        "Vendors selected against security and compliance criteria",
      ],
    },
  },

  sectors: {
    hero: {
      eyebrow: "Industries",
      title: "Industries we understand.",
      intro: "Every industry has its own constraints, vocabulary and priorities. Our approach adapts to each one.",
    },
    labels: {
      challenges: "Common challenges",
      support: "How we can help",
      explore: "View industry",
      formTitle: "A request for this industry?",
      formIntro: "Describe your need — your request will be associated with this industry.",
    },
    disclaimer:
      "AVORYN does not provide regulated accounting, tax, legal or staffing services. Our role focuses on organization, processes and technology.",
    items: {
      professional: {
        title: "Professional services",
        summary: "Firms, consultancies and service offices.",
        intro: "Professional services run on experts’ time. Every hour spent on administration is an hour taken away from clients.",
        challenges: [
          "Time tracking and billing",
          "Document management and client files",
          "Scheduling and repetitive communications",
        ],
        support: [
          "Assessment of administrative processes",
          "Automated follow-ups and communications",
          "Integration of practice management tools",
        ],
      },
      accounting: {
        title: "Accounting and administration",
        summary: "Accounting, finance and administrative functions.",
        intro: "Accounting demands rigour and traceability. Automation must strengthen control, never weaken it.",
        challenges: [
          "Entering and filing supporting documents",
          "Manual reconciliations and checks",
          "Producing recurring reports",
        ],
        support: [
          "Analysis of accounting and administrative flows",
          "Automated document collection",
          "Financial dashboards",
        ],
      },
      hr: {
        title: "Human resources and recruitment",
        summary: "HR departments, recruitment and staffing agencies.",
        intro: "Recruitment is a race against time, where the quality of follow-up makes the difference for candidates and clients alike.",
        challenges: [
          "Screening and tracking applications",
          "Coordinating interviews",
          "Managing files and compliance documents",
        ],
        support: [
          "Structuring the recruitment process",
          "Automated candidate follow-ups",
          "Tracking and reporting tools",
        ],
      },
      realEstate: {
        title: "Real estate",
        summary: "Investors, property managers and acquisition projects.",
        intro: "Real estate combines financial analysis, extensive documentation and close tracking of deadlines.",
        challenges: [
          "Assessing the profitability of acquisitions",
          "Tracking leases, deadlines and expenses",
          "Centralizing documents",
        ],
        support: ["Acquisition analysis models", "Tracking dashboards", "Automated reminders and filing"],
      },
      ecommerce: {
        title: "E-commerce",
        summary: "Online stores, including Shopify.",
        intro: "In e-commerce, growth multiplies the workload: orders, inventory, customer service and marketing.",
        challenges: ["Order and inventory management", "Repetitive customer service", "Scattered sales data"],
        support: ["Connecting the store with other tools", "Automating day-to-day operations", "Sales dashboards"],
      },
      publicProcurement: {
        title: "Public procurement",
        summary: "Businesses responding to public tenders.",
        intro: "Public procurement requires monitoring, compliance and careful preparation of bids.",
        challenges: [
          "Finding relevant tenders",
          "Preparing bid documents",
          "Tracking deadlines and requirements",
        ],
        support: ["Organizing tender monitoring", "Templates and a content library", "A bid preparation process"],
      },
    },
  },

  innovations: {
    hero: {
      eyebrow: "Innovation and projects",
      title: "AVORYN’s initiatives.",
      intro: "This page presents AVORYN’s entrepreneurial and technology initiatives, each with its actual stage of progress.",
    },
    statusTitle: "Clearly stated stages",
    statusIntro: "Each initiative is assigned one of the five stages below. No project is presented as more advanced than it is.",
    statuses: {
      concept: { label: "Concept", body: "An idea that has been articulated but not yet validated." },
      research: { label: "Research", body: "Studying the need, the market and feasibility." },
      prototype: { label: "Prototype", body: "A first version tested on a small scale." },
      development: { label: "In development", body: "A solution being built with a view to release." },
      available: { label: "Available", body: "A solution clients can use." },
    },
    axesTitle: "Areas of exploration",
    axesIntro: "These areas guide our work. They are not available products.",
    axes: [
      {
        status: "research",
        title: "Administrative automation",
        body: "Reducing the time small organizations spend on recurring administrative tasks.",
      },
      {
        status: "research",
        title: "Bid preparation",
        body: "Making it easier to monitor and prepare responses to public tenders.",
      },
      {
        status: "concept",
        title: "Business analysis tools",
        body: "Making business model and acquisition analysis more accessible.",
      },
    ],
    projectsTitle: "Projects",
    projectsEmpty: "Projects will be presented here once they reach a verifiable milestone.",
    note: "Initiatives from the founder’s background are not presented as AVORYN subsidiaries.",
  },

  insights: {
    hero: {
      eyebrow: "Insights",
      title: "Analysis and perspectives.",
      intro: "Digital transformation, artificial intelligence, productivity and entrepreneurship — carefully written articles, published once reviewed.",
    },
    topicsTitle: "Topics",
    topics: {
      digital: "Digital transformation",
      ai: "Artificial intelligence",
      productivity: "Productivity",
      enterpriseTech: "Enterprise technology",
      finance: "Finance and processes",
      entrepreneurship: "Entrepreneurship",
      innovation: "Innovation",
    },
    empty: {
      title: "First articles in preparation",
      body: "Our first articles are being written and reviewed. They will be published here once approved.",
    },
    draftBadge: "Draft — not published",
    draftNotice: "This article is a draft, visible only in review mode. It is not indexed.",
    readingTime: "min read",
    back: "All insights",
    published: "Published",
  },

  contact: {
    hero: {
      eyebrow: "Contact",
      title: "Let’s discuss your project.",
      intro: "Every request is read carefully. We will get back to you as soon as possible.",
    },
    aside: {
      title: "What happens next",
      steps: [
        "You describe your need in a few lines.",
        "We get back to you to arrange an initial conversation.",
        "If we can help, we propose a suitable approach.",
      ],
      directTitle: "Contact details",
      privacy:
        "The information you provide is used only to handle your request. It is never sold or used for advertising.",
      privacyLink: "Privacy policy",
    },
    form: {
      legendType: "Request type",
      types: {
        contact: "General enquiry",
        project: "Project request",
        partnership: "Partnership proposal",
      },
      name: "Full name",
      email: "Email address",
      organization: "Organization",
      optional: "optional",
      required: "required",
      sector: "Industry",
      sectorPlaceholder: "Select an industry",
      sectorOther: "Other or not specified",
      message: "Describe your need",
      messageHint: "Context, objective and desired timeline. Please do not include sensitive information (health, financial or identification numbers).",
      consentBefore: "I agree that AVORYN may use this information to respond to my request, in accordance with the ",
      consentLink: "privacy policy",
      consentAfter: ".",
      submit: "Send request",
      sending: "Sending…",
      honeypot: "Leave this field empty",
      errors: {
        summary: "The form contains errors:",
        typeInvalid: "Please choose a request type.",
        nameRequired: "Please enter your name.",
        nameTooLong: "Your name must not exceed 120 characters.",
        emailInvalid: "Please enter a valid email address.",
        organizationTooLong: "The organization name must not exceed 160 characters.",
        sectorInvalid: "Please choose a valid industry.",
        messageTooShort: "Please describe your need in at least 20 characters.",
        messageTooLong: "The description must not exceed 4,000 characters.",
        consentRequired: "Your consent is required to process this request.",
        rateLimited: "Too many requests have been sent from your connection. Please try again later.",
        rejected: "Your request could not be sent. Please try again in a moment.",
        unavailable: "Form submissions are not yet enabled on this site. Please try again later.",
        server: "Something went wrong while sending. Please try again.",
      },
      success: {
        title: "Thank you — your request has been received.",
        body: "We will review it and get back to you as soon as possible.",
        again: "Send another request",
      },
    },
  },

  privacy: {
    hero: {
      eyebrow: "Privacy",
      title: "Privacy policy",
      intro: "How we collect, use, retain and protect your personal information.",
    },
    draftNotice:
      "Draft to be completed and reviewed by legal counsel before going live. Items in square brackets must be filled in.",
    lastUpdated: "Last updated: [TO BE COMPLETED]",
    toComplete: "[TO BE COMPLETED]",
    sections: [
      {
        title: "1. Purpose and legal framework",
        paragraphs: [
          "This policy explains how {legalName} (“AVORYN”) collects, uses, discloses, retains and protects personal information.",
          "It is based on Québec’s Act respecting the protection of personal information in the private sector, as amended by Law 25, and, where applicable, the Personal Information Protection and Electronic Documents Act (PIPEDA).",
        ],
      },
      {
        title: "2. Person in charge of the protection of personal information",
        paragraphs: [
          "The person in charge of the protection of personal information is: {officerName}.",
          "They can be reached at: {officerEmail}.",
        ],
      },
      {
        title: "3. Information collected",
        paragraphs: ["We collect only the information needed to handle your request:"],
        list: [
          "request type, name, email address and, if you choose, your organization and industry;",
          "the description of your need, as you write it;",
          "the IP address of the connection, held temporarily in memory to limit abusive submissions, then discarded.",
        ],
      },
      {
        title: "4. Purposes",
        paragraphs: ["This information is used exclusively to:"],
        list: [
          "respond to your request and follow up on our exchanges;",
          "keep the site secure and prevent abuse (spam, automated submissions).",
        ],
      },
      {
        title: "5. Consent",
        paragraphs: [
          "Your consent is obtained explicitly through a checkbox before the form is submitted. You may withdraw it at any time by writing to the person in charge of the protection of personal information.",
        ],
      },
      {
        title: "6. Disclosure to third parties",
        paragraphs: [
          "Your information is never sold or rented. It may be processed by providers needed to operate the site: hosting ({hostingProvider}) and email delivery ({emailProvider}).",
          "If these providers process information outside Québec, a privacy impact assessment is carried out beforehand and contractual protection commitments are put in place.",
        ],
      },
      {
        title: "7. Retention",
        paragraphs: [
          "The site itself does not store requests in a database. Messages received are kept for {retention}, then destroyed or anonymized, unless the law requires otherwise.",
        ],
      },
      {
        title: "8. Security measures",
        list: [
          "encrypted connections (HTTPS);",
          "access to requests limited to those who need it;",
          "collection limited to what is strictly necessary;",
          "protection against automated submissions and abuse.",
        ],
        paragraphs: [],
      },
      {
        title: "9. Your rights",
        paragraphs: [
          "You may request access to your information, its correction, removal or portability, and withdraw your consent. We respond to requests within 30 days.",
          "You may also file a complaint with the Commission d’accès à l’information du Québec.",
        ],
      },
      {
        title: "10. Confidentiality incidents",
        paragraphs: [
          "Every confidentiality incident is recorded in a register. When an incident presents a risk of serious injury, the Commission d’accès à l’information and the individuals concerned are notified promptly.",
        ],
      },
      {
        title: "11. Cookies and analytics",
        paragraphs: [
          "The site uses no tracking cookies, no analytics tools and no advertising trackers. Should this change, your consent would be requested beforehand.",
        ],
      },
      {
        title: "12. Changes",
        paragraphs: ["This policy may be updated. The date of the latest update appears at the top of the page."],
      },
    ],
  },

  brand: {
    hero: {
      eyebrow: "Brand identity",
      title: "Logo, colours and typography.",
      intro: "A provisional identity proposal, pending approval before any official use.",
    },
    logoTitle: "The logo",
    logoBody:
      "A widened octagon evokes vision. Two lines converge — creation — into a vertical axis — progress — set above the base — stability. The O in the wordmark echoes the symbol’s geometry.",
    variants: {
      horizontal: "Horizontal version",
      vertical: "Vertical version",
      goldOnNight: "Gold on midnight blue",
      nightOnWhite: "Midnight blue on white",
      mono: "Monochrome",
      symbol: "Symbol and favicon",
    },
    download: "Download SVG",
    colorsTitle: "Colours",
    colorsBody: "Three official colours, supported by secondary interface tints.",
    primary: "Primary colours",
    secondary: "Secondary colours",
    colors: {
      night: "Midnight blue",
      champagne: "Champagne gold",
      white: "White",
      mist: "Light background",
      ink: "Primary text",
      slate: "Secondary text",
      line: "Borders",
      navy: "Secondary blue",
    },
    contrastTitle: "Contrast rules (WCAG 2.2 AA)",
    contrastRules: [
      "Champagne gold on midnight blue: 7.6:1 — compliant for all text.",
      "Champagne gold on white: 2.3:1 — decorative use only, never for text.",
      "Secondary text #64748B: white backgrounds only (4.8:1); on #F7F8FA, use #24344B.",
      "Form field borders: #64748B to reach 3:1.",
    ],
    typeTitle: "Typography",
    typeBody: "Inter, a sans-serif family designed for screens, self-hosted. Tight, confident headings and airy body text.",
    usageTitle: "Usage rules",
    usage: [
      "Keep clear space equal to the height of the O around the logo.",
      "Do not stretch, skew or recolour the logo outside the versions provided.",
      "Prefer the gold-on-midnight version for institutional materials.",
      "Use the monochrome version when printing is limited to one colour.",
    ],
  },

  notFound: {
    eyebrow: "Error 404",
    title: "This page could not be found.",
    body: "It may have moved, or the address may contain a typo.",
    cta: "Back to home",
  },
};
