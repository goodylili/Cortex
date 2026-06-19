// Prompt Studio — V1's "Prompt Generation / taste retention" pillar.
// Two orthogonal axes the user picks independently:
//   • Style  = the prompting technique/strategy (role, few-shot, chain-of-thought…)
//   • Type   = the output format/structure (plain text, JSON, XML, YAML…)
// A style builds a structured PromptSpec from your memories; a type renders that
// spec into the chosen markup. 10 styles × 10 types compose cleanly.
// Defaults: Role prompting + Plain text. Everything is grounded in what you've
// actually kept, with standing preferences weighted above passing context.

import type { Memory } from "./logic";

export type PromptStyle =
  | "zero"
  | "one"
  | "few"
  | "role"
  | "instruction"
  | "cot"
  | "rag"
  | "planning"
  | "reflection"
  | "multiturn";

export type PromptType =
  | "plain"
  | "chat"
  | "json"
  | "xml"
  | "yaml"
  | "template"
  | "markdown"
  | "function"
  | "multimodal"
  | "schema";

export type PromptModality = "text" | "image" | "audio" | "video";

export const DEFAULT_STYLE: PromptStyle = "role";
export const DEFAULT_TYPE: PromptType = "plain";
export const DEFAULT_MODALITY: PromptModality = "text";

export const MODALITIES: { id: PromptModality; name: string }[] = [
  { id: "text", name: "Text" },
  { id: "image", name: "Image" },
  { id: "audio", name: "Audio" },
  { id: "video", name: "Video" },
];

export const STYLES: { id: PromptStyle; name: string; hint: string }[] = [
  { id: "zero", name: "Zero-shot", hint: "Just the task, no examples" },
  { id: "one", name: "One-shot", hint: "A single worked example" },
  { id: "few", name: "Few-shot", hint: "A handful of examples" },
  {
    id: "role",
    name: "Role prompting",
    hint: "A persona that holds your voice",
  },
  { id: "instruction", name: "Instruction", hint: "Explicit imperative steps" },
  { id: "cot", name: "Chain-of-thought", hint: "Reason step by step" },
  { id: "rag", name: "Retrieval-augmented", hint: "Cited from your memory" },
  { id: "planning", name: "Planning", hint: "Plan, then execute" },
  { id: "reflection", name: "Reflection", hint: "Draft, critique, revise" },
  { id: "multiturn", name: "Multi-turn", hint: "Ongoing conversation" },
];

export const TYPES: { id: PromptType; name: string; ext: string }[] = [
  { id: "plain", name: "Plain text", ext: "txt" },
  { id: "chat", name: "Chat / messages", ext: "txt" },
  { id: "json", name: "JSON", ext: "json" },
  { id: "xml", name: "XML / tagged", ext: "xml" },
  { id: "yaml", name: "YAML", ext: "yaml" },
  { id: "template", name: "Template", ext: "txt" },
  { id: "markdown", name: "Markdown", ext: "md" },
  { id: "function", name: "Function / tool call", ext: "json" },
  { id: "multimodal", name: "Multi-modal", ext: "json" },
  { id: "schema", name: "Structured schema", ext: "json" },
];

export interface CompileInput {
  task: string;
  memories: Memory[];
  modality?: PromptModality;
}

const MODALITY_FRAMING: Record<Exclude<PromptModality, "text">, string> = {
  image:
    "Produce a prompt for an IMAGE-generation model: turn the intent and grounding below into a vivid visual description — subject, composition, style, lighting, mood.",
  audio:
    "Produce a prompt for an AUDIO / music-generation model: turn the intent and grounding below into a sound description — instrumentation, tempo, mood, texture.",
  video:
    "Produce a prompt for a VIDEO-generation model: turn the intent and grounding below into a scene description — action, motion, camera, pacing, mood.",
};

// ---- taste retention: standing preferences outrank passing context ----------
const isStanding = (m: Memory) => !!m.kept || m.importance === "high";
const topicsOf = (mems: Memory[]) =>
  Array.from(new Set(mems.flatMap((m) => m.tags))).slice(0, 8);
function provenance(mems: Memory[]): string {
  const kept = mems.filter((m) => m.kept).length;
  return `cortex · ${mems.length} memories (${kept} kept close) · ${new Date().toISOString().slice(0, 10)}`;
}

interface PromptSpec {
  style: PromptStyle;
  styleName: string;
  system: string; // the role/system framing line
  instructions: string[]; // technique directives (CoT steps, plan, reflect…)
  demos: string[]; // worked examples (one/few-shot)
  standing: string[]; // standing preferences (taste)
  context: string[]; // supporting context
  cited: boolean; // number the knowledge (RAG)
  topics: string[];
  task: string;
  provenance: string;
}

// ---- the style: build a structured spec from the memories -------------------
export function buildSpec(
  style: PromptStyle,
  { task, memories, modality = "text" }: CompileInput,
): PromptSpec {
  const goal = task.trim() || "Help me using what I already know.";
  const standing = memories.filter(isStanding).map((m) => m.text);
  const context = memories.filter((m) => !isStanding(m)).map((m) => m.text);
  const all = memories.map((m) => m.text);

  const spec: PromptSpec = {
    style,
    styleName: STYLES.find((s) => s.id === style)?.name ?? style,
    system:
      "You are a helpful assistant. Treat what I already know as ground truth.",
    instructions: [],
    demos: [],
    standing,
    context,
    cited: false,
    topics: topicsOf(memories),
    task: goal,
    provenance: provenance(memories),
  };

  switch (style) {
    case "zero":
      spec.system =
        "Answer the task using only the knowledge below. If something isn't covered, say so rather than guessing.";
      break;
    case "one":
      spec.system =
        "Here is one example of what's true about me. Stay consistent with it, then answer the task.";
      spec.demos = all.slice(0, 1);
      break;
    case "few":
      spec.system =
        "Here are a few examples of what's true about me and how I like things. Stay consistent with all of them, then answer the task.";
      spec.demos = all.slice(0, 4);
      break;
    case "role":
      spec.system =
        "You are my personal assistant. Adopt the standing preferences and voice below as your defaults, and never override them unless I explicitly say so.";
      break;
    case "instruction":
      spec.system =
        "Follow these instructions exactly, grounded in what I know.";
      spec.instructions = [
        "Be direct and concise.",
        "Use my known facts as ground truth, and cite them when you rely on one.",
        "If a needed fact is missing, ask instead of guessing.",
      ];
      break;
    case "cot":
      spec.system = "Reason step by step, grounding every step in what I know.";
      spec.instructions = [
        "Restate the task in your own words.",
        "List which known facts are relevant, and why.",
        "Work through the reasoning, citing the facts you use.",
        "Give the final answer, and flag anything the facts don't cover.",
      ];
      break;
    case "rag":
      spec.system =
        "Use the retrieved context below as your source of truth. Cite items by their number; if the answer isn't supported by the context, say so.";
      spec.cited = true;
      break;
    case "planning":
      spec.system = "Plan before you act, grounded in what I know.";
      spec.instructions = [
        "First write a short numbered plan.",
        "Then carry out each step in order.",
        "Treat my known facts as ground truth throughout.",
      ];
      break;
    case "reflection":
      spec.system = "Answer, then critique and improve your own answer.";
      spec.instructions = [
        "Draft an answer grounded in what I know.",
        "Critique the draft for errors, gaps, or anything that conflicts with my facts.",
        "Produce a revised, final answer.",
      ];
      break;
    case "multiturn":
      spec.system =
        "This is an ongoing conversation. Carry my preferences and context across every turn and stay consistent with them.";
      break;
  }
  if (modality !== "text") {
    spec.system = `${MODALITY_FRAMING[modality]} ${spec.system}`;
  }
  return spec;
}

// ---- the type: render the spec into the chosen markup -----------------------
const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
const numbered = (xs: string[]) =>
  xs.map((x, i) => `${i + 1}. ${x}`).join("\n");
const yamlStr = (s: string) =>
  `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const yamlList = (xs: string[], indent = "  ") =>
  xs.length
    ? xs.map((x) => `${indent}- ${yamlStr(x)}`).join("\n")
    : `${indent}[]`;
const knowledge = (spec: PromptSpec) => [...spec.standing, ...spec.context];

function render(type: PromptType, spec: PromptSpec): string {
  const k = knowledge(spec);
  switch (type) {
    case "plain":
      return [
        spec.system,
        spec.standing.length &&
          `Standing preferences:\n${bullets(spec.standing)}`,
        spec.context.length &&
          `${spec.cited ? "Retrieved context:" : "What I know:"}\n${spec.cited ? numbered(spec.context) : bullets(spec.context)}`,
        spec.demos.length && `Examples:\n${numbered(spec.demos)}`,
        spec.instructions.length &&
          `Instructions:\n${bullets(spec.instructions)}`,
        `Task: ${spec.task}`,
        `— ${spec.provenance}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "markdown":
      return [
        `# ${spec.styleName} prompt`,
        spec.system,
        spec.standing.length &&
          `## Standing preferences\n${bullets(spec.standing)}`,
        spec.context.length &&
          `## ${spec.cited ? "Retrieved context" : "What I know"}\n${spec.cited ? numbered(spec.context) : bullets(spec.context)}`,
        spec.demos.length && `## Examples\n${numbered(spec.demos)}`,
        spec.instructions.length &&
          `## Instructions\n${bullets(spec.instructions)}`,
        `## Task\n${spec.task}`,
        `> ${spec.provenance}`,
      ]
        .filter(Boolean)
        .join("\n\n");

    case "chat": {
      const sys = [
        spec.system,
        spec.standing.length &&
          `Standing preferences:\n${bullets(spec.standing)}`,
        spec.context.length &&
          `Context:\n${spec.cited ? numbered(spec.context) : bullets(spec.context)}`,
        spec.instructions.length &&
          `Instructions:\n${bullets(spec.instructions)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      const turns = [`System:\n${sys}`];
      spec.demos.forEach((d, i) => {
        turns.push(`User (example ${i + 1}):\n${d}`);
        turns.push(`Assistant:\nNoted — I'll stay consistent with this.`);
      });
      turns.push(`User:\n${spec.task}`);
      return turns.join("\n\n") + `\n\n<!-- ${spec.provenance} -->`;
    }

    case "json":
      return JSON.stringify(
        {
          kind: "cortex.prompt",
          style: spec.style,
          system: spec.system,
          standing: spec.standing,
          context: spec.context,
          examples: spec.demos,
          instructions: spec.instructions,
          topics: spec.topics,
          task: spec.task,
          provenance: spec.provenance,
        },
        null,
        2,
      );

    case "xml":
      return [
        `<prompt source="cortex" style="${spec.style}">`,
        `  <system>${spec.system}</system>`,
        spec.standing.length &&
          `  <standing>\n${spec.standing.map((s) => `    <preference>${s}</preference>`).join("\n")}\n  </standing>`,
        spec.context.length &&
          `  <context>\n${spec.context.map((s) => `    <memory>${s}</memory>`).join("\n")}\n  </context>`,
        spec.demos.length &&
          `  <examples>\n${spec.demos.map((s) => `    <example>${s}</example>`).join("\n")}\n  </examples>`,
        spec.instructions.length &&
          `  <instructions>\n${spec.instructions.map((s) => `    <step>${s}</step>`).join("\n")}\n  </instructions>`,
        `  <task>${spec.task}</task>`,
        `  <!-- ${spec.provenance} -->`,
        `</prompt>`,
      ]
        .filter(Boolean)
        .join("\n");

    case "yaml":
      return [
        "kind: cortex.prompt",
        `style: ${spec.style}`,
        `system: ${yamlStr(spec.system)}`,
        `standing:\n${yamlList(spec.standing)}`,
        `context:\n${yamlList(spec.context)}`,
        `examples:\n${yamlList(spec.demos)}`,
        `instructions:\n${yamlList(spec.instructions)}`,
        `topics: [${spec.topics.map(yamlStr).join(", ")}]`,
        `task: ${yamlStr(spec.task)}`,
        `provenance: ${yamlStr(spec.provenance)}`,
      ].join("\n");

    case "template":
      return [
        `# ${spec.styleName} template — fill {{task}} (and {{tone}}) at call time`,
        ``,
        `SYSTEM: ${spec.system}`,
        spec.standing.length ? `\nSTANDING:\n${bullets(spec.standing)}` : "",
        spec.context.length ? `\nKNOWLEDGE:\n${bullets(spec.context)}` : "",
        spec.instructions.length
          ? `\nINSTRUCTIONS:\n${bullets(spec.instructions)}`
          : "",
        ``,
        `TONE: {{tone}}`,
        `TASK: {{task}}`,
        ``,
        `# variables: task, tone`,
        `# ${spec.provenance}`,
      ]
        .filter((l) => l !== "")
        .join("\n");

    case "function":
      return JSON.stringify(
        {
          name: "answer_with_cortex_memory",
          description: spec.system,
          parameters: {
            type: "object",
            properties: {
              task: { type: "string", description: "What I need help with" },
              tone: { type: "string", description: "Voice/tone to use" },
            },
            required: ["task"],
          },
          grounding: {
            standing: spec.standing,
            context: spec.context,
            instructions: spec.instructions,
          },
          example_call: { task: spec.task },
          provenance: spec.provenance,
        },
        null,
        2,
      );

    case "multimodal":
      return JSON.stringify(
        {
          model: "any-multimodal",
          messages: [
            {
              role: "system",
              content: [{ type: "text", text: spec.system }],
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    spec.standing.length
                      ? `Standing preferences:\n${bullets(spec.standing)}`
                      : "",
                    spec.context.length
                      ? `Context:\n${bullets(spec.context)}`
                      : "",
                    `Task: ${spec.task}`,
                  ]
                    .filter(Boolean)
                    .join("\n\n"),
                },
                { type: "image_url", image_url: { url: "<attach an image>" } },
              ],
            },
          ],
          provenance: spec.provenance,
        },
        null,
        2,
      );

    case "schema":
      return JSON.stringify(
        {
          prompt: {
            system: spec.system,
            standing: spec.standing,
            context: spec.context,
            task: spec.task,
          },
          response_schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              used_memories: { type: "array", items: { type: "string" } },
              confidence: { type: "number", minimum: 0, maximum: 1 },
            },
            required: ["answer", "used_memories"],
          },
          provenance: spec.provenance,
        },
        null,
        2,
      );

    default:
      return k.join("\n");
  }
}

export function compilePrompt(
  style: PromptStyle,
  type: PromptType,
  input: CompileInput,
): string {
  return render(type, buildSpec(style, input));
}
