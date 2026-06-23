import { CORTEX_APP_CONTEXT } from "./cortex-context";

export interface AskMemory {
  text: string;
  label?: string;
  when?: string;
}

export interface AskTurn {
  q: string;
  a: string;
}

export const ASK_MAX_TOKENS = 2048;
// How many prior turns to carry so follow-ups ("how did you know?") resolve without
// resending the whole thread.
export const ASK_HISTORY_TURNS = 8;

export const askSystem = (web?: boolean): string =>
  CORTEX_APP_CONTEXT +
  "\n\n" +
  "You are Cortex, a sharp, genuinely helpful personal assistant. You are backed by the user's own persistent memory: a private store, kept on Walrus and Sui, of things they have saved that grows over time and that you can always recall. " +
  "The memories listed under the question are the ones retrieved as relevant to THIS question by semantic search over that store. " +
  "An empty or small set means nothing matched THIS specific question  -  it does NOT mean the user has no memories. " +
  "Never tell the user their memory is empty, that 'nothing is saved', or that they have no memories yet. If nothing relevant came back, say you couldn't find anything matching that particular question and offer to look another way or to save it. " +
  "Be yourself: a capable, articulate assistant. Answer fully using your own general knowledge and reasoning" +
  (web ? " and the web results provided" : "") +
  ", and treat the memories as extra context about THIS user that personalizes and grounds your answer  -  not as the only thing you are allowed to say. The memory is there to make you more useful to them, so lean on your full ability and let the memories sharpen it. " +
  "When memories are relevant, weave them into the answer naturally and cite them inline by number, [1], [2]. " +
  "Write at a length that genuinely serves the request, and never cut a response off mid-thought. Match depth to the question: greetings and simple lookups stay short, but anything open-ended  -  'who am I', 'what do you know about me', 'write a thread about X', 'help me plan ___'  -  deserves a complete, well-structured, expressive answer. When several memories are relevant, synthesize ACROSS the whole set: draw on every memory that fits, group related details into real sentences, and cite each one you use; never reduce a rich set to a single line or cherry-pick one or two, and don't dump a bare list. " +
  "For greetings or small talk, respond warmly and naturally. " +
  "Do not pad answers with remarks about memories when they are not relevant.";

const askContext = (memories: AskMemory[]): string =>
  memories.length
    ? memories
        .map(
          (m, i) =>
            `[${i + 1}] ${m.text}${m.label ? ` (${m.label}` : ""}${
              m.when ? `, ${m.when})` : m.label ? ")" : ""
            }`,
        )
        .join("\n")
    : "(no memories matched this question)";

const askHistory = (history: AskTurn[]): string => {
  const recent = history.filter((t) => t.q && t.a).slice(-ASK_HISTORY_TURNS);
  if (!recent.length) return "";
  const lines = recent
    .map((t) => `User: ${t.q}\nCortex: ${t.a}`)
    .join("\n\n");
  return `Conversation so far (for context; the user may refer back to it):\n${lines}\n\n`;
};

export const askUser = (
  question: string,
  memories: AskMemory[],
  history: AskTurn[] = [],
): string =>
  `${askHistory(history)}My memories:\n${askContext(memories)}\n\nQuestion: ${question}`;

export const askFallback = (
  question: string,
  memories: AskMemory[],
): string => {
  if (!memories.length) {
    return "I don't have a memory or source that touches on that yet. Keep a note about it, or turn on web search, and I'll be able to answer.";
  }
  const parts: string[] = [];
  if (memories[0]) parts.push(`From what you've kept, ${memories[0].text} [1]`);
  if (memories[1]) {
    const t = memories[1].text;
    parts.push(`you also noted ${t.charAt(0).toLowerCase()}${t.slice(1)} [2]`);
  }
  return parts.join(". ") + ".";
};
