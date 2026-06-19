// Folder watcher: ingest files dropped into the configured watch paths. Uses
// node:fs watching; each new/changed file becomes a Source and is extracted.

import { watch, readFileSync, existsSync, statSync } from "node:fs";
import { extname, basename, resolve } from "node:path";
import { homedir } from "node:os";
import type { Clients } from "../../sui/app/clients";
import type { Config } from "./config";
import type { SourceKind } from "./models";
import { ingestSource } from "./sync";

const TYPE_BY_EXT: Record<string, SourceKind> = {
  ".md": "document",
  ".txt": "document",
  ".pdf": "document",
  ".docx": "document",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".mp3": "audio",
  ".wav": "audio",
  ".m4a": "audio",
  ".mp4": "video",
  ".mov": "video",
};

function expand(p: string): string {
  return p.startsWith("~")
    ? resolve(homedir(), p.slice(1).replace(/^\//, ""))
    : resolve(p);
}

export function startWatcher(
  c: Clients,
  cfg: Config,
  onIngest?: (uri: string) => void,
): () => void {
  const stops: (() => void)[] = [];
  for (const raw of cfg.watch.paths) {
    const dir = expand(raw);
    if (!existsSync(dir)) continue;
    const w = watch(dir, async (_event, filename) => {
      if (!filename) return;
      const full = resolve(dir, filename.toString());
      if (!existsSync(full) || !statSync(full).isFile()) return;
      const type = TYPE_BY_EXT[extname(full).toLowerCase()] ?? "document";
      try {
        const text = type === "document" ? readFileSync(full, "utf8") : "";
        const bytes =
          type === "image" ? new Uint8Array(readFileSync(full)) : undefined;
        await ingestSource(c, cfg, {
          type,
          uri: full,
          title: basename(full),
          text,
          bytes,
          hint: basename(full),
        });
        onIngest?.(full);
      } catch {
        /* skip unreadable */
      }
    });
    stops.push(() => w.close());
  }
  return () => stops.forEach((s) => s());
}
