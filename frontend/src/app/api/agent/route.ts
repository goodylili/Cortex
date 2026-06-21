// Runs ONE step for a single collaboration agent. Given the agent's id, the task
// goal, its prior observations, and the shared memories it may draw on, this builds
// the agent's system prompt and grounded user content and calls the chosen model.
// Mirrors the ask route: it never 500s on a missing provider key  -  it degrades to a
// deterministic observation that restates the goal so the team can keep moving.

import { agentById } from "@/lib/cortex/agents";
import { modelByName } from "@/lib/llm/models";
import { complete } from "@/lib/llm/complete";
import { CORTEX_APP_CONTEXT } from "@/lib/llm/cortex-context";

interface StepMemory {
  text: string;
  label?: string;
  when?: string;
}

interface ThreadMessage {
  from: string;
  text: string;
}

interface Body {
  agentId: string;
  system?: string;
  goal: string;
  observations: string[];
  memories: StepMemory[];
  thread?: ThreadMessage[];
  model?: string;
}

const MAX_TOKENS = 700;

function formatMemories(memories: StepMemory[]): string {
  if (!memories.length) return "(no shared memories supplied)";
  return memories
    .map((m, i) => {
      const meta =
        m.label && m.when
          ? ` (${m.label}, ${m.when})`
          : m.label
            ? ` (${m.label})`
            : m.when
              ? ` (${m.when})`
              : "";
      return `[${i + 1}] ${m.text}${meta}`;
    })
    .join("\n");
}

function formatObservations(observations: string[]): string {
  if (!observations.length) return "(none yet)";
  return observations.map((o, i) => `(${i + 1}) ${o}`).join("\n");
}

const MAX_THREAD = 12;

function formatThread(thread: ThreadMessage[]): string {
  const recent = thread.filter((m) => m.text).slice(-MAX_THREAD);
  if (!recent.length) return "(no messages yet)";
  return recent.map((m) => `${m.from}: ${m.text}`).join("\n");
}

function fallbackObservation(goal: string): string {
  return `No model key is configured, so I can't reason on this step. The goal stands: ${goal}. Handoff suggestion: configure a provider key, then re-run this agent.`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }

  const {
    agentId,
    system,
    goal,
    observations = [],
    memories = [],
    thread = [],
    model,
  } = body;
  const agent = agentById(agentId);
  const ownPrompt = agent?.system ?? system;
  if (!ownPrompt) {
    return Response.json(
      { error: `unknown agentId "${agentId}" and no system prompt supplied` },
      { status: 400 },
    );
  }
  // Every agent answers as itself, but on top of a shared understanding of what
  // Cortex is and how the app is laid out, so it can also help the user navigate.
  const systemPrompt = `${CORTEX_APP_CONTEXT}\n\n${ownPrompt}`;

  const chosen = modelByName(model);
  const user = [
    `Goal: ${goal}`,
    "",
    "Conversation in this task room (most recent last):",
    formatThread(thread),
    "",
    "Shared memories:",
    formatMemories(memories),
    "",
    "Prior observations:",
    formatObservations(observations),
  ].join("\n");

  const result = await complete({
    model: chosen,
    system: systemPrompt,
    user,
    maxTokens: MAX_TOKENS,
  });

  return result.ok
    ? Response.json({ observation: result.text, ai: true, model: chosen.name })
    : Response.json({
        observation: fallbackObservation(goal),
        ai: false,
        reason: result.reason,
      });
}
