"use client";

import Link from "next/link";
import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";

export default function InstallPage() {
  return (
    <>
      <article className="article">
        <header>
          <h1>Install</h1>
          <p className="tagline">
            Get Cortex running locally. It works out of the box in mock mode &mdash; no wallet,
            keys, or credentials required.
          </p>
        </header>

        <section>
          <h2 id="prerequisites">Prerequisites</h2>
          <ul>
            <li>
              <strong>Node.js 20+</strong> &mdash; the runtime for every surface
            </li>
            <li>
              <strong>pnpm</strong> &mdash; the monorepo uses pnpm workspaces (<code>pnpm@9</code>)
            </li>
          </ul>
          <p>
            If you do not have pnpm, install it with <code>corepack enable</code> or follow the{" "}
            <a href="https://pnpm.io/installation" target="_blank" rel="noopener noreferrer">
              pnpm install guide
            </a>
            .
          </p>
        </section>

        <section>
          <h2 id="clone-and-install">Clone and install</h2>
          <p>Clone the repository and install all workspace dependencies from the root:</p>
          <CodeBlock
            language="bash"
            copyable
            code={`git clone https://github.com/your-org/cortex.git
cd cortex
pnpm install`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            A single <code>pnpm install</code> at the root wires up the frontend app, the core
            runtime, the docs site, and the MCP server.
          </p>
        </section>

        <section>
          <h2 id="run-the-surfaces">Run the surfaces</h2>
          <p>
            Cortex exposes the same memory plane through several surfaces. Each has its own root
            script &mdash; run whichever you need.
          </p>

          <h3>Frontend app</h3>
          <p>The Next.js product experience. Open it at http://localhost:3000.</p>
          <CodeBlock language="bash" copyable code={`pnpm dev`} />

          <h3>Documentation site</h3>
          <p>This docs site, served locally.</p>
          <CodeBlock language="bash" copyable code={`pnpm dev:docs`} />

          <h3>MCP server</h3>
          <p>
            The Model Context Protocol server that lets external agents reach Cortex memory. Use{" "}
            <code>dev:mcp</code> while iterating, or <code>start:mcp</code> to run it directly.
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`pnpm dev:mcp
# or
pnpm start:mcp`}
          />

          <h3>CLI demo</h3>
          <p>
            The quickest way to exercise the full pipeline outside the UI. The demo seeds sample
            sources, extracts memories, runs consolidation (<em>dream</em>), applies the resulting
            diff, and verifies artifact fetchability &mdash; all in mock mode.
          </p>
          <CodeBlock language="bash" copyable code={`pnpm --filter @cortex/core demo`} />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            The same demo is also wired to <code>pnpm demo</code> from the repo root. Output prints
            the seeded memory count, the consolidation operations, the applied diff, and a verify
            line showing how many blobs are fetchable.
          </p>
        </section>

        <section>
          <h2 id="mock-vs-live">Mock mode vs. live mode</h2>
          <p>
            <strong>Mock mode is the default.</strong> When live configuration is incomplete, Cortex
            runs the entire pipeline &mdash; ingest, extract, recall, consolidate, verify &mdash; on
            your machine with no external dependencies. The CLI prints a{" "}
            <code>(mock mode &mdash; missing for live: &hellip;)</code> banner so you always know which
            path you are on. Use mock mode to build the product, test the memory pipeline, and iterate
            on prompts and extraction without any blockchain or storage setup.
          </p>
          <p>
            <strong>Live mode</strong> turns on once the required infrastructure config is present. On
            the live path Cortex uses <strong>Sui</strong> for identity and coordination,{" "}
            <strong>Walrus</strong> for durable artifact storage, <strong>Seal</strong> for encryption
            and access gating, and <strong>MemWal</strong> for persistent memory namespaces and
            recall.
          </p>

          <h3>Frontend configuration</h3>
          <p>
            Copy the frontend env template and fill in what you need. Leaving values unset keeps the
            app on the local mock path.
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`cp frontend/.env.example frontend/.env.local`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            This file controls Privy authentication, client-side Sui and Walrus endpoints, deployed
            package and registry ids, Seal key server ids and threshold, MemWal relayer and contract
            ids, and model provider API keys for the app&apos;s API routes.
          </p>

          <h3>Core and MCP runtime configuration</h3>
          <p>Copy the runtime config template used by the core runtime and MCP server.</p>
          <CodeBlock
            language="bash"
            copyable
            code={`cp frontend/config/config.example.yaml frontend/config/config.yaml`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: "0.5rem" }}>
            This file sets the namespace, Sui RPC and network, Walrus publisher and aggregator, Seal
            policy package and object, MemWal URL and API key, watched folder paths, and model
            defaults. Some secrets can also be overridden with environment variables such as{" "}
            <code>MEMWAL_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, <code>SEAL_SERVER_IDS</code>,
            and <code>SEAL_THRESHOLD</code>.
          </p>
        </section>

        <section>
          <h2 id="connect-an-agent">Connect an agent</h2>
          <p>
            Once the MCP server is running, you can connect any MCP client &mdash; Claude Code, Cursor,
            and other hosts &mdash; so your agents read and write the same Cortex memory. Point the
            client at the running server and it gains recall, remember, ingest, verify, and
            consolidation tools.
          </p>
          <p>
            See the{" "}
            <Link href="/mcp" className="styled-link">
              MCP Server
            </Link>{" "}
            page for client setup, authorization, and the full tool list.
          </p>
        </section>

        <section>
          <h2 id="next-steps">Next steps</h2>
          <ul>
            <li>
              <Link href="/features" className="styled-link">
                Concepts
              </Link>{" "}
              &mdash; how ingestion, recall, and consolidation fit together
            </li>
            <li>
              <Link href="/schema" className="styled-link">
                Data Model
              </Link>{" "}
              &mdash; the Source, Memory, Extraction, and MemoryDiff types
            </li>
            <li>
              <Link href="/api" className="styled-link">
                Core API
              </Link>{" "}
              &mdash; using the <code>Cortex</code> class directly in code
            </li>
          </ul>
        </section>
      </article>

      <Footer />
    </>
  );
}
