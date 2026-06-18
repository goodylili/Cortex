export type ProfileFieldType = "text" | "textarea" | "list" | "url";

export interface ProfileField {
  key: string;
  label: string;
  placeholder: string;
  type: ProfileFieldType;
  fact: (value: string) => string;
}

export interface ProfileStep {
  title: string;
  blurb: string;
  fields: ProfileField[];
}

export type UserProfile = Record<string, string>;

export const ONBOARDING_STEPS: ProfileStep[] = [
  {
    title: "Who you are",
    blurb: "The core of your story.",
    fields: [
      {
        key: "name",
        label: "Your name",
        placeholder: "Ada Lovelace",
        type: "text",
        fact: (v) => `My name is ${v}.`,
      },
      {
        key: "location",
        label: "Where you're based",
        placeholder: "Berlin, Germany",
        type: "text",
        fact: (v) => `I'm based in ${v}.`,
      },
      {
        key: "oneLiner",
        label: "One line that describes you",
        placeholder: "Full-stack engineer & founder",
        type: "text",
        fact: (v) => `In a line, I'd describe myself as ${v}.`,
      },
      {
        key: "story",
        label: "Tell your story",
        placeholder: "Who you are and how you got here, in a few sentences.",
        type: "textarea",
        fact: (v) => `My story: ${v}`,
      },
      {
        key: "languages",
        label: "Languages you speak",
        placeholder: "English, Urdu…",
        type: "list",
        fact: (v) => `I speak ${v}.`,
      },
    ],
  },
  {
    title: "Your life",
    blurb: "The people and places around you.",
    fields: [
      {
        key: "hometown",
        label: "Where you grew up",
        placeholder: "Lagos, Nigeria",
        type: "text",
        fact: (v) => `I grew up in ${v}.`,
      },
      {
        key: "relationship",
        label: "Relationship status",
        placeholder: "Married, single, partnered…",
        type: "text",
        fact: (v) => `My relationship status: ${v}.`,
      },
      {
        key: "family",
        label: "Family",
        placeholder: "Partner, kids, siblings, pets…",
        type: "textarea",
        fact: (v) => `About my family: ${v}`,
      },
      {
        key: "living",
        label: "Living situation",
        placeholder: "Live alone, with family, roommates…",
        type: "text",
        fact: (v) => `My living situation: ${v}.`,
      },
      {
        key: "birthday",
        label: "Birthday",
        placeholder: "March 14",
        type: "text",
        fact: (v) => `My birthday is ${v}.`,
      },
    ],
  },
  {
    title: "What you enjoy",
    blurb: "Life outside of work.",
    fields: [
      {
        key: "hobbies",
        label: "Hobbies & interests",
        placeholder: "Climbing, chess, vinyl…",
        type: "list",
        fact: (v) => `My hobbies and interests include ${v}.`,
      },
      {
        key: "media",
        label: "Favourite books, shows or music",
        placeholder: "Dune, Severance, jazz…",
        type: "textarea",
        fact: (v) => `Some favourites of mine: ${v}`,
      },
      {
        key: "food",
        label: "Food & drink you love",
        placeholder: "Ramen, espresso, spicy food…",
        type: "list",
        fact: (v) => `Food and drink I love: ${v}.`,
      },
      {
        key: "weekends",
        label: "How you spend weekends",
        placeholder: "Hiking, cooking, side projects…",
        type: "textarea",
        fact: (v) => `On weekends I usually ${v}`,
      },
      {
        key: "travel",
        label: "Places you love or want to visit",
        placeholder: "Japan, Lisbon…",
        type: "list",
        fact: (v) => `Places I love or want to visit: ${v}.`,
      },
    ],
  },
  {
    title: "Your work",
    blurb: "What you do day to day.",
    fields: [
      {
        key: "role",
        label: "Role or title",
        placeholder: "Senior Engineer",
        type: "text",
        fact: (v) => `My role is ${v}.`,
      },
      {
        key: "company",
        label: "Company or organisation",
        placeholder: "Acme Inc.",
        type: "text",
        fact: (v) => `I work at ${v}.`,
      },
      {
        key: "industry",
        label: "Industry",
        placeholder: "Fintech, healthcare…",
        type: "text",
        fact: (v) => `I work in ${v}.`,
      },
      {
        key: "focus",
        label: "What you're working on",
        placeholder: "Building a payments platform…",
        type: "textarea",
        fact: (v) => `Right now I'm working on: ${v}`,
      },
      {
        key: "experience",
        label: "Years of experience",
        placeholder: "8 years",
        type: "text",
        fact: (v) => `I have ${v} of experience.`,
      },
    ],
  },
  {
    title: "Skills & tools",
    blurb: "How you get things done.",
    fields: [
      {
        key: "skills",
        label: "Skills & expertise",
        placeholder: "TypeScript, system design…",
        type: "list",
        fact: (v) => `My skills include ${v}.`,
      },
      {
        key: "tools",
        label: "Tools you use daily",
        placeholder: "VS Code, Figma, Linear…",
        type: "list",
        fact: (v) => `Tools I use daily: ${v}.`,
      },
      {
        key: "learning",
        label: "What you're learning",
        placeholder: "Rust, machine learning…",
        type: "list",
        fact: (v) => `I'm currently learning ${v}.`,
      },
      {
        key: "sideProjects",
        label: "Side projects",
        placeholder: "An open-source CLI…",
        type: "textarea",
        fact: (v) => `My side projects: ${v}`,
      },
    ],
  },
  {
    title: "Goals & values",
    blurb: "What drives you.",
    fields: [
      {
        key: "goals",
        label: "Goals for this year",
        placeholder: "Ship v1, run a marathon…",
        type: "textarea",
        fact: (v) => `My goals for this year: ${v}`,
      },
      {
        key: "values",
        label: "What matters most to you",
        placeholder: "Honesty, craft, family…",
        type: "list",
        fact: (v) => `What matters most to me: ${v}.`,
      },
      {
        key: "workStyle",
        label: "How you like to work",
        placeholder: "Deep focus mornings, async…",
        type: "textarea",
        fact: (v) => `How I like to work: ${v}`,
      },
      {
        key: "communication",
        label: "Communication style",
        placeholder: "Direct and concise",
        type: "text",
        fact: (v) => `My communication style is ${v}.`,
      },
    ],
  },
  {
    title: "Socials & links",
    blurb: "Where to find you.",
    fields: [
      {
        key: "website",
        label: "Website",
        placeholder: "https://you.com",
        type: "url",
        fact: (v) => `My website is ${v}.`,
      },
      {
        key: "github",
        label: "GitHub",
        placeholder: "github.com/you",
        type: "url",
        fact: (v) => `My GitHub is ${v}.`,
      },
      {
        key: "twitter",
        label: "X / Twitter",
        placeholder: "@you",
        type: "text",
        fact: (v) => `My X / Twitter is ${v}.`,
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        placeholder: "linkedin.com/in/you",
        type: "url",
        fact: (v) => `My LinkedIn is ${v}.`,
      },
      {
        key: "otherSocial",
        label: "Anywhere else",
        placeholder: "Mastodon, Bluesky…",
        type: "text",
        fact: (v) => `You can also find me at ${v}.`,
      },
    ],
  },
  {
    title: "For Cortex",
    blurb: "How I can help you best.",
    fields: [
      {
        key: "help",
        label: "How should Cortex help you?",
        placeholder: "Remember context, draft replies…",
        type: "textarea",
        fact: (v) => `How I'd like Cortex to help: ${v}`,
      },
      {
        key: "alwaysRemember",
        label: "Topics to always remember",
        placeholder: "My projects, my contacts…",
        type: "textarea",
        fact: (v) => `Topics I want Cortex to always remember: ${v}`,
      },
      {
        key: "avoid",
        label: "Anything to avoid?",
        placeholder: "Don't surface work on weekends…",
        type: "textarea",
        fact: (v) => `Things Cortex should avoid: ${v}`,
      },
    ],
  },
];

export const PROFILE_FIELDS: ProfileField[] = ONBOARDING_STEPS.flatMap(
  (s) => s.fields,
);

export const TOTAL_QUESTIONS = PROFILE_FIELDS.length;

export const profileAnsweredCount = (profile: UserProfile): number =>
  PROFILE_FIELDS.reduce(
    (n, f) => n + (profile[f.key]?.trim() ? 1 : 0),
    0,
  );

export const HIGH_IMPORTANCE_KEYS = new Set([
  "name",
  "location",
  "role",
  "company",
]);

export const profileToMemories = (
  profile: UserProfile,
): { text: string; high: boolean }[] =>
  PROFILE_FIELDS.filter((f) => profile[f.key]?.trim()).map((f) => ({
    text: f.fact(profile[f.key]!.trim()),
    high: HIGH_IMPORTANCE_KEYS.has(f.key),
  }));
