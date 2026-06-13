#!/usr/bin/env node
// cortex <command>
//   demo                 seed sample sources, consolidate, verify (mock, no creds)
//   ingest <file>        ingest a file into the namespace
//   dream [--apply]      run consolidation; commits diff first
//   verify               fetch all blobs from the aggregator (relayer bypassed)
//   watch                watch configured folders and ingest changes

import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { loadConfig, isLive, missingForLive } from "./config";
import { createClients } from "../../sui/app/clients";
import { ingestSource, runDream, applyDiff, verify } from "./sync";
import { seedDemo } from "./demo";
import { startWatcher } from "./watcher";
import type { SourceKind } from "./models";

const cfg = loadConfig();
const c = createClients(cfg);
const cmd = process.argv[2];
const has = (f: string) => process.argv.includes("--" + f);

const TYPE: Record<string, SourceKind> = {
  ".md": "document",
  ".txt": "document",
  ".png": "image",
  ".jpg": "image",
  ".mp3": "audio",
  ".mp4": "video",
};

async function main() {
  if (!isLive(cfg))
    console.log(
      `(mock mode — missing for live: ${missingForLive(cfg).join(", ") || "nothing"})\n`,
    );

  switch (cmd) {
    case "demo": {
      await seedDemo(c, cfg);
      const { memories } = await c.memwal.restore(cfg.namespace);
      console.log(`seeded ${memories.length} memories from sample sources.`);
      const { diff, diffBlobId } = await runDream(c, cfg);
      console.log(
        `dream ${diff.diffId}: ${diff.operations.length} ops committed -> ${diffBlobId} (parentHead ${diff.parentHead})`,
      );
      diff.operations.forEach((op) =>
        console.log(
          `  · ${op.type} (conf ${op.confidence}) evidence ${op.evidence.length}`,
        ),
      );
      const r = await applyDiff(c, diff);
      console.log(`applied ${r.applied} ops -> new head ${r.newHead}`);
      const v = await verify(c, cfg);
      console.log(
        `verify: ${v.fetched}/${v.total} blobs fetchable from aggregator. head ${v.head}`,
      );
      break;
    }
    case "ingest": {
      const file = process.argv[3];
      if (!file || !existsSync(file) || !statSync(file).isFile()) {
        console.error("usage: cortex ingest <file>");
        process.exit(1);
      }
      const type = TYPE[extname(file).toLowerCase()] ?? "document";
      const text = type === "document" ? readFileSync(file, "utf8") : "";
      const bytes =
        type === "image" ? new Uint8Array(readFileSync(file)) : undefined;
      const r = await ingestSource(c, cfg, {
        type,
        uri: file,
        title: basename(file),
        text,
        bytes,
        hint: basename(file),
      });
      console.log(
        `ingested ${r.source.id}: ${r.memoryIds.length} memories. ${r.extraction.summary}`,
      );
      break;
    }
    case "dream": {
      const { diff, diffBlobId } = await runDream(c, cfg);
      console.log(
        `dream ${diff.diffId}: ${diff.operations.length} ops committed -> ${diffBlobId}`,
      );
      if (has("apply")) {
        const r = await applyDiff(c, diff);
        console.log(`applied ${r.applied} ops -> ${r.newHead}`);
      } else console.log("run with --apply to commit.");
      break;
    }
    case "verify": {
      const v = await verify(c, cfg);
      console.log(`${v.fetched}/${v.total} blobs fetchable. head ${v.head}`);
      break;
    }
    case "watch": {
      const stop = startWatcher(c, cfg, (uri) => console.log("ingested", uri));
      console.log(
        `watching ${cfg.watch.paths.length} path(s). ctrl-c to stop.`,
      );
      process.on("SIGINT", () => {
        stop();
        process.exit(0);
      });
      break;
    }
    default:
      console.log(
        "commands: demo | ingest <file> | dream [--apply] | verify | watch",
      );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
