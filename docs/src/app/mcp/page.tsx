"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import { MCPDiagram } from "../components/MCPDiagram";

function ToolRow({ name, desc }: { name: string; desc: string }) {
  return (
    <tr>
      <td
        style={{
          padding: "0.375rem 0.75rem 0.375rem 0",
          borderBottom: "1px solid var(--line)",
          fontFamily: "var(--font-mono)",
          fontSize: "0.6875rem",
          color: "var(--ink)",
          whiteSpace: "nowrap",
          verticalAlign: "top",
        }}
      >
        {name}
      </td>
      <td
        style={{
          padding: "0.375rem 0",
          borderBottom: "1px solid var(--line)",
          color: "var(--muted)",
          verticalAlign: "top",
        }}
      >
        {desc}
      </td>
    </tr>
  );
}

function ToolGroup({
  title,
  blurb,
  tools,
}: {
  title: string;
  blurb: string;
  tools: { name: string; desc: string }[];
}): React.JSX.Element {
  return (
    <>
      <h3 style={{ marginTop: "1.5rem" }}>{title}</h3>
      <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{blurb}</p>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.75rem",
          marginTop: "0.5rem",
        }}
      >
        <tbody>
          {tools.map((t) => (
            <ToolRow key={t.name} name={t.name} desc={t.desc} />
          ))}
        </tbody>
      </table>
    </>
  );
}

const HINT_STYLE = {
  fontSize: "0.8125rem",
  color: "var(--muted)",
  marginTop: "0.5rem",
} as const;

export default function McpPage(): React.JSX.Element {
  return (
    <>
      <article className="article">
        <header>
          <h1>MCP Server</h1>
          <p className="tagline">
            Expose the whole Cortex memory plane to any MCP host over one connector
          </p>
        </header>

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            <code>cortex-mcp</code> is a Model Context Protocol server that puts your
            entire Cortex memory plane behind a single connector. External hosts and
            agents &mdash; Claude, ChatGPT, Cursor, VS Code, Claude Code &mdash; connect
            to it and read and write the <strong>same durable, Walrus-backed memory</strong>.
            A decision made in one tool is recalled in every other.
          </p>
          <p>
            It exposes far more than recall and remember. The server registers tools
            across five groups &mdash; memory, the multi-agent hub, your authorized
            on-chain data, low-level execution, and outbound connectors &mdash; plus
            browsable MCP resources and ready-made prompts. Tasks and messages persist
            as event-sourced MemWal records, so every connected host collaborates over
            shared state rather than its own private scratchpad.
          </p>
          <p style={HINT_STYLE}>
            <code>MCP hosts</code> &harr; <code>cortex-mcp</code> &harr;{" "}
            <code>shared Walrus memory</code>
          </p>

          <MCPDiagram />
        </section>

        <section>
          <h2 id="installation">Installation</h2>
          <p>
            The server ships in the monorepo as the <code>cortex-mcp</code> package and
            runs over stdio. Start it from the repo root:
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`# from the repo root
pnpm start:mcp

# or directly
pnpm --filter cortex-mcp start`}
          />
          <p style={HINT_STYLE}>
            The only optional dependency is{" "}
            <code>@modelcontextprotocol/sdk</code>, loaded lazily at startup.
          </p>

          <h3>Mock vs live</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            With no live credentials configured, the server boots in{" "}
            <strong>mock mode</strong> and seeds a demo namespace &mdash; ideal for
            wiring up a client and trying the tools without Sui, Walrus, Seal, or MemWal.
            Once the live path is configured, the same tools read and write durable
            memory. The server logs which mode it connected in:
          </p>
          <CodeBlock
            language="bash"
            code={`cortex-mcp connected (mock)
  memory: memory_recall, memory_remember, memory_ingest, ...
  agents: agent_list, task_create, task_list, ...
  connectors: web_fetch, service_notify, service_export
  resources: cortex://memory, cortex://timeline, ...
  prompts: summarize_memory, daily_digest`}
          />
        </section>

        <section>
          <h2 id="connect-a-client">Connect a Client</h2>
          <p>
            Hosted deployments expose a single <strong>connector URL</strong>. Point any
            MCP host at it and the full Cortex toolset appears in that client.
          </p>
          <CodeBlock
            language="text"
            copyable
            code={`https://mcp.cortex.id/mcp`}
          />
          <p style={HINT_STYLE}>
            If you run the server yourself, connect over stdio with the start command
            above instead of a URL.
          </p>

          <h3>Claude</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Open <strong>Settings &rarr; Connectors &rarr; Add custom connector</strong>,
            paste the connector URL, click Connect, and approve the Cortex tools.
          </p>

          <h3>ChatGPT</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Open <strong>Settings &rarr; Connectors</strong> (enable developer mode if
            prompted), choose <strong>Add connector</strong> &rarr; custom MCP server,
            paste the connector URL, and authorize the connection. Every chat can then
            read your memory and quietly write back what is worth keeping.
          </p>

          <h3>Claude Code</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Register Cortex as an HTTP MCP server, then restart Claude Code &mdash; the
            tools appear automatically.
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`claude mcp add --transport http cortex https://mcp.cortex.id/mcp`}
          />

          <h3>Cursor &amp; VS Code</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Add the server to your MCP config (Cursor:{" "}
            <strong>Settings &rarr; MCP</strong>; VS Code: the MCP servers view or your
            settings JSON), then reload the window.
          </p>
          <CodeBlock
            language="json"
            copyable
            code={`{
  "mcpServers": {
    "cortex": {
      "url": "https://mcp.cortex.id/mcp"
    }
  }
}`}
          />
        </section>

        <section>
          <h2 id="authorize">Authorize</h2>
          <p>
            Memory, agents, and connector tools work as soon as a client connects. The{" "}
            <strong>your-data</strong> tools (<code>user_profile</code>,{" "}
            <code>user_memory</code>, <code>user_context</code>) are different: they read{" "}
            <em>your</em> on-chain account, so they require an explicit grant.
          </p>
          <p>
            Authorizing records an on-chain <strong>admin grant</strong> from your Cortex
            account (<code>account::grant_admin</code>) to the MCP server&apos;s wallet.
            Once granted, the server can surface your public profile (display name,
            handle, bio), your distilled MemWal facts, and your durable context pointers
            (sessions, events, docs, agent state). The grant is{" "}
            <strong>revocable at any time</strong> &mdash; revoke it and those tools stop
            returning your data.
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Context pointers reference Seal/AES-encrypted Walrus blobs. Decrypting the
            verbatim transcripts requires <strong>your own key</strong> (owner-only); the
            MCP works from the distilled facts in <code>user_memory</code> for context,
            never the raw encrypted transcripts.
          </p>
        </section>

        <section>
          <h2 id="tools">Tools</h2>
          <p>
            The server registers the tools below. Descriptions are the one-liners the
            server advertises to clients.
          </p>

          <ToolGroup
            title="Memory"
            blurb="Read, write, consolidate, and verify your durable memory."
            tools={[
              { name: "memory_recall", desc: "Recall memories from the namespace (verified-first)." },
              { name: "memory_remember", desc: "Write a durable memory." },
              { name: "memory_ingest", desc: "Ingest a note/document and extract memories from it." },
              { name: "memory_forget", desc: "De-index a memory (tombstone); the raw record stays on Walrus." },
              { name: "memory_verify_stamp", desc: "Stamp a memory as verified at a given time (defaults to now)." },
              { name: "memory_list", desc: "List all live memories in the namespace." },
              { name: "memory_timeline", desc: "Version history (manifest versions) for the namespace." },
              { name: "memory_tags", desc: "Tag frequencies across live memories." },
              { name: "memory_digest", desc: "Period digest of memories (optional from/to window)." },
              { name: "memory_connections", desc: "Inferred relations between live memories." },
              { name: "memory_extraction", desc: "Fetch the extraction artifact stored at a Walrus blob id." },
              { name: "memory_head", desc: "Current head (latest committed version hash) of the namespace." },
              { name: "dream_run", desc: "Consolidate memory; commits a diff, applies only if apply=true." },
              { name: "verify_memory", desc: "Verify all blobs are fetchable from the public aggregator." },
            ]}
          />

          <ToolGroup
            title="Agents"
            blurb="Drive the specialist agent team over a durable task board and message bus, all shared through Walrus memory."
            tools={[
              { name: "agent_list", desc: "List the specialist agents (id, name, role, blurb) sharing this memory." },
              { name: "task_create", desc: "Open a task and assign it to an agent; returns the durable record." },
              { name: "task_list", desc: "List the team's tasks (latest revision of each), newest first." },
              { name: "task_get", desc: "Fetch one task by id, including its observations and outputs." },
              { name: "task_observe", desc: "Append an observation to a task as a given agent." },
              { name: "task_handoff", desc: "Reassign a task to another agent; posts a handoff to the bus." },
              { name: "task_complete", desc: "Mark a task done, rolling its latest observation into outputs." },
              { name: "agent_run_step", desc: "Run one collaborative step: recall, reason, record an observation + bus message." },
              { name: "agent_message_post", desc: "Post a message to the durable agent bus." },
              { name: "agent_message_list", desc: "Read the agent message bus, newest first (optional taskId filter)." },
            ]}
          />

          <ToolGroup
            title="Your data"
            blurb="Read the granting user's on-chain account. Requires an admin grant (see Authorize) and is revocable."
            tools={[
              { name: "user_profile", desc: "Read an authorized user's public on-chain account and which context keys exist." },
              { name: "user_memory", desc: "Recall an authorized user's distilled memory facts from their MemWal namespace." },
              { name: "user_context", desc: "Read an authorized user's durable CONTEXT pointers (sessions, events, docs, agent state)." },
            ]}
          />

          <ToolGroup
            title="Execution"
            blurb="Low-level actions under the server's own Sui wallet (admin identity): write blobs, record pointers, manage shared files."
            tools={[
              { name: "wallet_info", desc: "The MCP server's own Sui wallet, network, and live status." },
              { name: "walrus_put_blob", desc: "Store raw bytes on Walrus (utf8 or base64); returns the blob id." },
              { name: "walrus_get_blob", desc: "Fetch a raw Walrus blob by id (base64 by default, or utf8)." },
              { name: "sui_record_pointer", desc: "Record a namespace → manifest blob pointer on Sui; returns the digest." },
              { name: "sui_read_pointer", desc: "Read the on-chain manifest pointer for a namespace." },
              { name: "kb_grant_access", desc: "Grant a delegate read access to a shared KbFile (as executor)." },
              { name: "kb_renew", desc: "Extend a shared KbFile's Walrus storage to a later end epoch (as executor)." },
              { name: "memwal_restore", desc: "Restore the full namespace head + memories (incl. tombstoned) from MemWal." },
            ]}
          />

          <ToolGroup
            title="Connectors"
            blurb="Bridge Cortex to the web and other services. See the Outbound page for usage."
            tools={[
              { name: "web_fetch", desc: "Fetch a URL and return its text; with ingest=true it also becomes durable memory." },
              { name: "service_notify", desc: "POST a JSON payload to the configured CORTEX_WEBHOOK_URL (Slack/Discord/Zapier)." },
              { name: "service_export", desc: "Return a portable JSON bundle (namespace, head, memories) for syncing into other tools." },
            ]}
          />
        </section>

        <section>
          <h2 id="resources">Resources</h2>
          <p>
            The server also publishes browsable MCP resources. Hosts that support
            resources can read these directly as JSON without invoking a tool:
          </p>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.75rem",
              marginTop: "0.5rem",
            }}
          >
            <tbody>
              <ToolRow name="cortex://memory" desc="All live memories in the namespace." />
              <ToolRow name="cortex://timeline" desc="Version history (manifest versions) for the namespace." />
              <ToolRow name="cortex://digest" desc="Full-period digest of the namespace's memories." />
              <ToolRow name="cortex://agents" desc="The specialist agents that share this memory." />
              <ToolRow name="cortex://tasks" desc="The team's durable tasks (latest revision of each)." />
            </tbody>
          </table>
        </section>

        <section>
          <h2 id="prompts">Prompts</h2>
          <p>
            Two ready-made MCP prompts turn your memory into a working brief. They pull
            live data from your namespace and hand the model a fully formed message.
          </p>

          <h3>summarize_memory</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Pulls recent memories (default 20, override with <code>limit</code>) into a
            prompt that asks the model to summarize the key themes across them.
          </p>

          <h3>daily_digest</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Turns the namespace digest into a request for a concise daily briefing.
          </p>
        </section>
      </article>

      <Footer />
    </>
  );
}
