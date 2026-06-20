#!/usr/bin/env node
// cortex <command>
//   demo                 seed sample sources, consolidate, verify (mock, no creds)
//   ingest <file>        ingest a file into the namespace
//   dream [--apply]      run consolidation; commits diff first
//   verify               fetch all blobs from the aggregator (relayer bypassed)
//   watch                watch configured folders and ingest changes
//   loop run <loopId>    drive a persisted loop to a terminal state (executor)
//   loop step <loopId>   advance a persisted loop by one iteration
//   loop host [secs]     run the scheduler daemon, firing due loops on an interval
//   loop flag <loopId> <text>  sharpen a loop's critic rubric from a human-flagged miss

import { readFileSync, existsSync, statSync } from "node:fs";
import { basename, extname } from "node:path";
import { loadConfig, isLive, missingForLive } from "./config";
import { createClients } from "../../sui/app/clients";
import { ingestSource, runDream, applyDiff, verify } from "./sync";
import { seedDemo } from "./demo";
import { startWatcher } from "./watcher";
import { flagRubricMiss, runLoop, stepLoop } from "./loops";
import { startLoopHost } from "./loop-host";
import type { SourceKind } from "./models";

const MS_PER_SECOND = 1000;

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
      `(mock mode  -  missing for live: ${missingForLive(cfg).join(", ") || "nothing"})\n`,
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
    case "loop": {
      const sub = process.argv[3];

      if (sub === "host") {
        const secs = Number.parseInt(process.argv[4] ?? "", 10);
        const intervalMs = Number.isFinite(secs) && secs > 0 ? secs * MS_PER_SECOND : undefined;
        const host = startLoopHost(c, cfg, {
          ...(intervalMs !== undefined ? { intervalMs } : {}),
          onTick: (fired) => {
            if (fired.length) console.log(`fired ${fired.length} loop(s): ${fired.join(", ")}`);
          },
          onError: (err) => console.error("tick failed:", err.message),
        });
        console.log("loop scheduler running. ctrl-c to stop.");
        process.on("SIGINT", () => {
          host.stop();
          process.exit(0);
        });
        break;
      }

      if (sub === "flag") {
        const loopId = process.argv[4];
        const flag = process.argv.slice(5).join(" ");
        if (!loopId || !flag) {
          console.error("usage: cortex loop flag <loopId> <what the verifier missed>");
          process.exit(1);
        }
        const rubric = await flagRubricMiss(c, cfg, loopId, flag);
        console.log(
          `rubric ${rubric.id} for loop ${loopId}: ${rubric.criteria.length} criteria`,
        );
        rubric.criteria.forEach((criterion) => console.log(`  · ${criterion}`));
        break;
      }

      const loopId = process.argv[4];
      if ((sub !== "run" && sub !== "step") || !loopId) {
        console.error(
          "usage: cortex loop run <loopId> | step <loopId> | host [secs] | flag <loopId> <text>",
        );
        process.exit(1);
      }
      const result =
        sub === "run"
          ? await runLoop(c, cfg, loopId)
          : await stepLoop(c, cfg, loopId);
      console.log(
        `loop ${loopId}: status ${result.status}, ${result.run.iterations.length} iteration(s), verdict ${result.verdict}, tokens ${result.run.tokensUsed}`,
      );
      const last = result.run.iterations[result.run.iterations.length - 1];
      if (last)
        console.log(
          `  · last gate ${last.gate ?? "(none)"} -> ${last.verdict}: ${last.feedback.slice(0, 120)}`,
        );
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
        "commands: demo | ingest <file> | dream [--apply] | verify | watch | loop run|step <loopId> | loop host [secs] | loop flag <loopId> <text>",
      );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
