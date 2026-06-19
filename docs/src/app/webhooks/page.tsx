"use client";

import { Footer } from "../Footer";
import { CodeBlock } from "../components/CodeBlock";
import { WebhooksDiagram } from "../components/WebhooksDiagram";

const HINT_STYLE = {
  fontSize: "0.8125rem",
  color: "var(--muted)",
  marginTop: "0.5rem",
} as const;

export default function OutboundPage(): React.JSX.Element {
  return (
    <>
      <article className="article">
        <header>
          <h1>Outbound</h1>
          <p className="tagline">
            Pull the web into memory, push events to your services, and let agents talk
          </p>
        </header>

        <section>
          <h2 id="overview">Overview</h2>
          <p>
            The MCP server&apos;s outbound layer bridges Cortex to the world beyond your
            namespace. It pulls external content <strong>into</strong> memory, pushes
            events <strong>out</strong> to your services, and exports a portable copy of
            everything you have kept. A durable agent bus lets connected agents message
            each other across that same shared memory.
          </p>
          <ul style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            <li>
              <code>web_fetch</code> &mdash; fetch a URL, optionally as durable memory
            </li>
            <li>
              <code>service_notify</code> &mdash; POST events to a Slack / Discord /
              Zapier webhook
            </li>
            <li>
              <code>service_export</code> &mdash; a portable JSON bundle of your memory
            </li>
            <li>
              <code>agent_message_post</code> / <code>agent_message_list</code> &mdash;
              the durable agent message bus
            </li>
          </ul>

          <WebhooksDiagram />
        </section>

        <section>
          <h2 id="web-fetch">Web Fetch</h2>
          <p>
            <code>web_fetch</code> fetches a URL and returns its text. By default it is a
            read-only fetch. Pass <code>ingest: true</code> and the fetched content is
            run through extraction and written as <strong>durable memory</strong> &mdash;
            so the page becomes recallable from every connected client.
          </p>
          <CodeBlock
            language="json"
            copyable
            code={`// fetch only — returns the page text
{ "url": "https://example.com/post" }

// fetch and remember — extracts memories from the page
{ "url": "https://example.com/post", "ingest": true }`}
          />
          <p style={HINT_STYLE}>
            With <code>ingest=true</code> the response confirms the byte count, the source
            id, and how many memories were extracted. Requests time out after 30 seconds.
          </p>
        </section>

        <section>
          <h2 id="notify">Notify</h2>
          <p>
            <code>service_notify</code> POSTs a JSON payload to the webhook configured in{" "}
            <code>CORTEX_WEBHOOK_URL</code> &mdash; any Slack, Discord, or Zapier incoming
            webhook. Use it to push memory events out to the rest of your stack. The tool
            errors if <code>CORTEX_WEBHOOK_URL</code> is unset.
          </p>
          <CodeBlock
            language="bash"
            copyable
            code={`# .env — an incoming webhook for Slack, Discord, or Zapier
CORTEX_WEBHOOK_URL=https://hooks.slack.com/services/T000/B000/XXXX`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Call it with an <code>event</code> name and an optional{" "}
            <code>payload</code> object:
          </p>
          <CodeBlock
            language="json"
            copyable
            code={`{
  "event": "memory.kept",
  "payload": { "summary": "Decided to ship the connector page" }
}`}
          />
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            The server wraps your call and POSTs the envelope below to the webhook:
          </p>
          <CodeBlock
            language="json"
            code={`{
  "source": "cortex-mcp",
  "namespace": "default",
  "event": "memory.kept",
  "payload": { "summary": "Decided to ship the connector page" },
  "at": "2026-06-19T12:00:00.000Z"
}`}
          />
        </section>

        <section>
          <h2 id="export">Export</h2>
          <p>
            <code>service_export</code> returns a portable JSON bundle of your namespace
            &mdash; the current head and every live memory &mdash; ready to sync into
            another tool, back up, or hand to another agent. It takes no arguments.
          </p>
          <CodeBlock
            language="json"
            code={`{
  "kind": "cortex.export.v1",
  "namespace": "default",
  "head": "a1b2c3...",
  "live": true,
  "exportedAt": "2026-06-19T12:00:00.000Z",
  "memories": [ /* every live memory in the namespace */ ]
}`}
          />
        </section>

        <section>
          <h2 id="agent-bus">Agent Bus</h2>
          <p>
            The agent bus is a <strong>durable, event-sourced message stream</strong>
            stored as MemWal records alongside your memory. Connected agents &mdash; and
            you &mdash; post and read messages over it, so collaboration survives across
            sessions, hosts, and restarts instead of living in one client&apos;s
            transient context.
          </p>

          <h3>agent_message_post</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Post a message to the bus. <code>from</code> and <code>to</code> may be an
            agent id, <code>&quot;user&quot;</code>, or <code>&quot;team&quot;</code>;{" "}
            <code>kind</code> is one of <code>handoff</code>, <code>note</code>, or{" "}
            <code>result</code>; <code>taskId</code> ties the message to a task.
          </p>
          <CodeBlock
            language="json"
            copyable
            code={`{
  "from": "researcher",
  "to": "curator",
  "taskId": "task_42",
  "kind": "handoff",
  "content": "Gathered the sources — ready for you to distill."
}`}
          />

          <h3>agent_message_list</h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
            Read the bus newest-first. Both arguments are optional: filter by{" "}
            <code>taskId</code>, and cap results with <code>limit</code>.
          </p>
          <CodeBlock
            language="json"
            copyable
            code={`{ "taskId": "task_42", "limit": 20 }`}
          />
          <p style={HINT_STYLE}>
            Handoffs raised by <code>task_handoff</code> are posted to this same bus, so
            the message stream is the single record of how a task moved across the team.
          </p>
        </section>
      </article>

      <Footer />
    </>
  );
}
