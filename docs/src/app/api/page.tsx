"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";

export default function APIPage(): React.JSX.Element {
  return (
    <>
      <article className="article">
        <header>
          <h1>Core API</h1>
          <p className="tagline">
            The <code>Cortex</code> facade — embed the local-first memory plane directly
          </p>
        </header>

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            Cortex is local-first. There is no HTTP backend to call — the desktop and
            mobile apps embed the runtime directly, and the only server in the system is
            the <a href="/mcp">MCP connector</a>, which reaches the same memory plane
            through this same facade.
          </p>
          <p>
            The programmatic entry point is the <code>Cortex</code> class. It wraps the
            ingest, recall, consolidation, and verification pipelines and exposes derived
            read views over a namespace. Everything is exported from the
            {" "}<code>@cortex/core</code> package.
          </p>
          <CodeBlock
            language="typescript"
            copyable
            code={`import { openCortex } from "@cortex/core";

// loadConfig() runs automatically; with no live credentials
// configured, Cortex runs against mock infrastructure.
const cortex = openCortex();

await cortex.ingestText("Shipped the v1 data model today.", "standup");
const hits = await cortex.recall("data model");`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            <code>ingest</code> &rarr; extract memories &rarr; store on
            {" "}Sui / Walrus / Seal / MemWal &rarr; <code>recall</code> &rarr; consolidate.
          </p>
        </section>

        <section>
          <h2 id="cortex-class">Cortex Class</h2>
          <p>
            Construct a <code>Cortex</code> directly or call <code>openCortex()</code>.
            Both take an optional <code>Config</code>; when omitted, the constructor calls
            {" "}<code>loadConfig()</code> for you. The instance builds its storage clients
            once and reuses them for the lifetime of the object.
          </p>
          <CodeBlock
            language="typescript"
            code={`class Cortex {
  readonly cfg: Config;
  readonly clients: Clients;

  constructor(cfg?: Config);   // defaults to loadConfig()

  get namespace(): string;     // the active namespace from config
  get live(): boolean;         // true once live infra is fully configured
}

function openCortex(cfg?: Config): Cortex;`}
          />
          <p>
            <code>namespace</code> is the per-user memory space the facade reads and
            writes; <code>live</code> reports whether all required live infrastructure
            fields are present (see <a href="#configuration">Configuration</a>). When
            {" "}<code>live</code> is <code>false</code>, every operation runs against the
            deterministic mock clients.
          </p>
        </section>

        <section>
          <h2 id="ingest">Ingest</h2>
          <p>
            <code>ingest</code> takes a single source, extracts memories from it, writes
            those memories into the live memory plane, and updates the namespace manifest.
            <code>ingestText</code> is a convenience wrapper for inline notes.
          </p>
          <CodeBlock
            language="typescript"
            code={`ingest(input: IngestInput): Promise<IngestResult>;

ingestText(text: string, title?: string): Promise<IngestResult>;

interface IngestInput {
  type: SourceKind;   // "note" | "document" | "image" | "audio"
                      //  | "video" | "url" | "structured"
  uri: string;        // path or URL
  title?: string;
  text?: string;
  bytes?: Uint8Array;
  hint?: string;
}

interface IngestResult {
  source: Source;
  extraction: Extraction;
  memoryIds: string[];
}`}
          />
          <CodeBlock
            language="typescript"
            copyable
            code={`const { source, memoryIds } = await cortex.ingest({
  type: "document",
  uri: "file:///notes/architecture.md",
  title: "Architecture notes",
  text: rawMarkdown,
});

console.log(\`stored \${memoryIds.length} memories from \${source.id}\`);`}
          />
        </section>

        <section>
          <h2 id="recall">Recall</h2>
          <p>
            <code>recall</code> queries the namespace for relevant memories. Pass an empty
            query to list everything, or a <code>limit</code> to cap results.
            {" "}<code>memories</code> returns the full restored set without ranking.
          </p>
          <CodeBlock
            language="typescript"
            code={`recall(query?: string, limit?: number): Promise<Memory[]>;

memories(): Promise<Memory[]>;   // full restored namespace

head(): Promise<string>;         // current state hash of the namespace`}
          />
          <CodeBlock
            language="typescript"
            copyable
            code={`const relevant = await cortex.recall("storage layer", 5);
for (const m of relevant) {
  console.log(m.confidence.toFixed(2), m.text);
}`}
          />
        </section>

        <section>
          <h2 id="consolidate">Consolidate</h2>
          <p>
            Consolidation runs in two stages so it is always inspectable and never
            destructive by surprise. <code>dream</code> loads the namespace, asks the
            consolidator to propose operations (merge, pattern, prune, verify), and commits
            the resulting <code>MemoryDiff</code> to Walrus <em>before</em> anything mutates.
            <code>apply</code> then mutates the live memory after an optimistic
            parent-head concurrency check. <code>dreamAndApply</code> chains both.
          </p>
          <CodeBlock
            language="typescript"
            code={`dream(): Promise<DreamResult>;
apply(diff: MemoryDiff): Promise<ApplyResult>;
dreamAndApply(): Promise<ApplyResult>;

interface DreamResult {
  diff: MemoryDiff;       // proposed operations + parentHead guard
  diffBlobId: string;     // already committed to Walrus
}

interface ApplyResult {
  newHead: string;
  suiTxn: string;
  applied: number;        // operations applied
}`}
          />
          <CodeBlock
            language="typescript"
            copyable
            code={`// Inspect before applying.
const { diff } = await cortex.dream();
console.log(diff.operations.map((op) => op.type));

// apply throws if the head moved since the dream — re-run if so.
const result = await cortex.apply(diff);
console.log(\`applied \${result.applied}, new head \${result.newHead}\`);`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            <code>apply</code> rejects with <code>head moved</code> when another writer has
            advanced the namespace since the dream was taken. Re-run <code>dream</code> to
            rebase against the new head.
          </p>
        </section>

        <section>
          <h2 id="views">Views</h2>
          <p>
            Derived read views are computed over the restored namespace. They are pure
            projections — none of them mutate memory.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", marginTop: "0.75rem", marginBottom: "1rem" }}>
            <tbody>
              <ViewRow sig="memories()" desc="Full restored memory set for the namespace" />
              <ViewRow sig="tags()" desc="Tag counts across all memories" />
              <ViewRow sig="digest(period?)" desc="Summary + highlights for a time window" />
              <ViewRow sig="timeline()" desc="Ordered VersionRef history from the manifest" />
              <ViewRow sig="connections()" desc="Inferred relations between memories" />
              <ViewRow sig="head()" desc="Current state hash of the namespace" />
            </tbody>
          </table>
          <CodeBlock
            language="typescript"
            code={`tags(): Promise<TagsArtifact>;
digest(period?: { from: string; to: string }): Promise<Digest>;
connections(): Promise<ConnectionsArtifact>;
timeline(): Promise<VersionRef[]>;`}
          />
          <CodeBlock
            language="typescript"
            copyable
            code={`const digest = await cortex.digest({ from: "2026-01", to: "2026-06" });
console.log(digest.summary);
console.log(digest.highlights);

const { tags } = await cortex.tags();
const top = tags.sort((a, b) => b.count - a.count)[0];`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            See <a href="/output">Memory Views</a> for the full shape of each artifact and
            <a href="/schema"> Data Model</a> for the underlying types.
          </p>
        </section>

        <section>
          <h2 id="verify">Verify</h2>
          <p>
            <code>verify</code> is the developer trust layer. It fetches every blob in the
            namespace manifest — sources, extractions, and diffs — straight from the Walrus
            aggregator, bypassing the relayer, and reports how many were reachable. Use it
            to confirm that committed state is actually durable on the live path.
          </p>
          <CodeBlock
            language="typescript"
            code={`verify(): Promise<{ fetched: number; total: number; head: string }>;`}
          />
          <CodeBlock
            language="typescript"
            copyable
            code={`const { fetched, total, head } = await cortex.verify();
if (fetched < total) {
  console.warn(\`\${total - fetched} blob(s) not reachable at head \${head}\`);
}`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            In mock mode every blob resolves locally, so <code>fetched</code> equals
            {" "}<code>total</code>.
          </p>
        </section>

        <section>
          <h2 id="configuration">Configuration</h2>
          <p>
            <code>loadConfig()</code> reads <code>config/config.yaml</code> from the working
            directory (if present), deep-merges it over the defaults, and applies environment
            overrides for secrets. The deterministic core runs with none of it — these values
            only wire the live clients.
          </p>
          <CodeBlock
            language="typescript"
            code={`function loadConfig(path?: string): Config;
function isLive(cfg: Config): boolean;
function missingForLive(cfg: Config): string[];

interface Config {
  namespace: string;
  sui: { rpc: string; network: string };
  walrus: { publisher: string; aggregator: string; epochs: number };
  seal: {
    policyPackage: string;
    policyObject: string;
    serverIds: string[];
    threshold: number;
  };
  memwal: { url: string; apiKey: string };
  delegateKey: string;
  models: { chat: string; extract: string; anthropicApiKey: string };
  watch: { paths: string[] };
  webhookUrl: string;
  accessRegistryId: string;
  executorCapId: string;
  workspaceId: string;
}`}
          />

          <h3 style={{ marginTop: "1.25rem" }}>Mock vs. live</h3>
          <p>
            Cortex defaults to <strong>mock mode</strong>. It switches to the live path only
            once every field <code>missingForLive</code> checks is populated:
            {" "}<code>walrus.publisher</code>, <code>walrus.aggregator</code>,
            {" "}<code>sui.rpc</code>, <code>memwal.url</code>, <code>memwal.apiKey</code>,
            and <code>delegateKey</code>. <code>isLive(cfg)</code> (and the
            {" "}<code>cortex.live</code> getter) returns <code>true</code> only when that
            list is empty.
          </p>

          <h3 style={{ marginTop: "1.25rem" }}>Environment overrides</h3>
          <p>
            Secrets and deployment-specific ids can be supplied via environment variables,
            which take precedence over the YAML file:
          </p>
          <CodeBlock
            language="bash"
            code={`CORTEX_DELEGATE_KEY     # signing key for the delegate
MEMWAL_API_KEY          # MemWal relayer key
ANTHROPIC_API_KEY       # model provider key for extraction/chat
CORTEX_WEBHOOK_URL      # outbound notification target
CORTEX_WORKSPACE_ID     # shared multi-agent workspace
CORTEX_ACCESS_REGISTRY  # on-chain access registry object id
CORTEX_EXECUTOR_CAP     # executor capability object id
SEAL_SERVER_IDS         # comma-separated Seal key server ids
SEAL_THRESHOLD          # Seal decryption threshold (integer)`}
          />
          <CodeBlock
            language="typescript"
            copyable
            code={`import { loadConfig, isLive, openCortex } from "@cortex/core";

const cfg = loadConfig();
if (!isLive(cfg)) {
  console.log("running in mock mode");
}
const cortex = openCortex(cfg);`}
          />
        </section>
      </article>

      <Footer />
    </>
  );
}

function ViewRow({ sig, desc }: { sig: string; desc: string }): React.JSX.Element {
  return (
    <tr>
      <td
        style={{
          padding: "0.375rem 0",
          borderBottom: "1px solid var(--line)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          width: "12rem",
        }}
      >
        {sig}
      </td>
      <td
        style={{
          padding: "0.375rem 0",
          borderBottom: "1px solid var(--line)",
          color: "var(--muted)",
        }}
      >
        {desc}
      </td>
    </tr>
  );
}
