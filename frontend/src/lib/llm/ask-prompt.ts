



export interface AskMemory {
  text: string;
  label?: string;
  when?: string;
}

export const ASK_MAX_TOKENS = 700;

export const askSystem = (web?: boolean): string =>
  "You are Cortex, a sharp, genuinely helpful personal assistant with access to the user's saved memories. " +
  "Always be useful: answer directly and conversationally, drawing on your own general knowledge" +
  (web ? " and the web results provided" : "") +
  ". When the provided memories are relevant, weave them into the answer and cite them inline as [1], [2] by number. " +
  "For greetings or small talk, just respond warmly and naturally. " +
  "If the user explicitly asks about what they have saved and no memories are provided, say briefly that nothing is saved on that yet, then still help however you can. " +
  "Do not pad answers with remarks about memories when they are not relevant. Keep it concise.";

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
