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
        key: "hobbies",
        label: "Hobbies & interests",
        placeholder: "Climbing, chess, vinyl…",
        type: "list",
        fact: (v) => `My hobbies and interests include ${v}.`,
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
        key: "focus",
        label: "What you're working on",
        placeholder: "Building a payments platform…",
        type: "textarea",
        fact: (v) => `Right now I'm working on: ${v}`,
      },
    ],
  },
  {
    title: "Where to find you",
    blurb: "Your links and socials.",
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
