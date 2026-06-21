



export interface AskMemory {
  text: string;
  label?: string;
  when?: string;
}

export const ASK_MAX_TOKENS = 700;

export const askSystem = (web?: boolean): string =>
  "You are Cortex, a warm, capable personal assistant that also has access to the user's saved memories. " +
  "Answer naturally and helpfully, like a normal assistant would. " +
  "When the provided memories are relevant, ground your answer in them and cite them inline as [1], [2] matching their numbers. " +
  "When no memory is relevant (a greeting, small talk, or a general question), just answer normally" +
  (web ? ", drawing on general knowledge" : "") +
  ". Never tell the user there are no memories; only bring up memory when it actually helps. Keep it concise and conversational.";

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
