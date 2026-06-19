// Seeds a namespace with sample personal sources so the system runs end-to-end
// on the mock with no creds. Used by `cortex demo` and the server's mock mode.

import type { Clients } from "../../sui/app/clients";
import type { Config } from "./config";
import { ingestSource } from "./sync";

const SAMPLES: { type: "note" | "document"; title: string; text: string }[] = [
  {
    type: "note",
    title: "standup",
    text: "Shipped the auth refactor today. Prefer pnpm over npm for this repo. The deploy runs on Tuesdays.",
  },
  {
    type: "note",
    title: "standup-2",
    text: "Auth refactor merged. We use pnpm here, not npm. Standup is at 10am.",
  },
  {
    type: "document",
    title: "trip",
    text: "Flying to Lisbon on March 3rd. Hotel is near Alfama. Remember the adapter for EU plugs.",
  },
  {
    type: "note",
    title: "prefs",
    text: "I like my coffee black. Dark mode everywhere. Deep work in the mornings.",
  },
];

export async function seedDemo(c: Clients, cfg: Config): Promise<void> {
  for (const s of SAMPLES) {
    await ingestSource(c, cfg, {
      type: s.type,
      uri: "demo://" + s.title,
      title: s.title,
      text: s.text,
      hint: s.title,
    });
  }
}
