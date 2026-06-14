// Durable layer for the agent collaboration subsystem. The shared task board and
// the agent message bus persist as two settings on the user's Account: each is an
// encrypted Walrus blob whose id is recorded on Sui via account::set_setting. Like
// the timeline and document index, the local cache is the instant source of truth
// and this is the durable, owned copy. Encryption and the on-chain pointer are
// reused wholesale from the generic saveState/loadState helpers in sessions.ts.

"use client";

import { loadState, saveState } from "./sessions";
import type { PrivySuiSigner } from "./signer";
import type { AgentMessage, AgentTask } from "../agents";

export const TASKS_KEY = "agents:tasks";
export const BUS_KEY = "agents:bus";

export async function saveTasks(
  signer: PrivySuiSigner,
  accountId: string,
  tasks: AgentTask[],
): Promise<void> {
  await saveState(signer, accountId, TASKS_KEY, tasks);
}

export async function loadTasks(
  signer: PrivySuiSigner,
  accountId: string,
): Promise<AgentTask[] | null> {
  const loaded = await loadState(signer, accountId, TASKS_KEY);
  return Array.isArray(loaded) ? (loaded as AgentTask[]) : null;
}

export async function saveBus(
  signer: PrivySuiSigner,
  accountId: string,
  messages: AgentMessage[],
): Promise<void> {
  await saveState(signer, accountId, BUS_KEY, messages);
}

export async function loadBus(
  signer: PrivySuiSigner,
  accountId: string,
): Promise<AgentMessage[] | null> {
  const loaded = await loadState(signer, accountId, BUS_KEY);
  return Array.isArray(loaded) ? (loaded as AgentMessage[]) : null;
}
