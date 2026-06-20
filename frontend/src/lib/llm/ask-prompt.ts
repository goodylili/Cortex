

export interface AskMemory {
  text: string;
  label?: string;
  when?: string;
}

export const ASK_MAX_TOKENS = 700;

export const askSystem = (web?: boolean): string =>
  "You are Cortex, a calm personal memory assistant. Answer the user's question using ONLY the memories provided" +
  (web ? ", drawing on general knowledge to fill gaps" : "") +
  ". Cite the memories you use inline as [1], [2], matching their numbers. " +
  "If the memories don't cover the question" +
  (web ? " and you are unsure" : "") +
  ", say so plainly rather than inventing an answer. Keep it concise, warm, and in the user's voice.";

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

export const askUser = (question: string, memories: AskMemory[]): string =>
  `My memories:\n${askContext(memories)}\n\nQuestion: ${question}`;

export const askFallback = (question: string, memories: AskMemory[]): string => {
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
