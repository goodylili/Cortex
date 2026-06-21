// Erase every trace of the signed-in user from this browser. Cortex keeps the
// durable copy of a user's world on the Sui stack (chain + Walrus + MemWal), so
// the browser only ever holds a cache plus a few local identity markers. On
// sign-out we drop all of it; only device/UI preferences (theme, network, the
// non-secret device id) survive, since they identify the device, not the person.

"use client";

import { clearVault } from "@/lib/llm/byok-vault";
import { clearLocalProfile } from "@/lib/cortex/store";
import { clearMemoryCreds } from "@/lib/cortex/walrus/memory";

const LOCAL_IDENTITY_KEYS = ["cortex-username", "cortex-session"];

export function forgetLocalIdentity(): void {
  clearLocalProfile();
  clearVault();
  clearMemoryCreds();
  try {
    for (const key of LOCAL_IDENTITY_KEYS) localStorage.removeItem(key);
  } catch {}
}
