// Sui reads over GraphQL (JSON-RPC is deprecated). Execution + Walrus/Seal go over
// gRPC (see clients.ts); object-field reads go here because GraphQL returns Move
// fields as JSON, where gRPC returns raw BCS. One memoized client.

"use client";

import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { graphql } from "@mysten/sui/graphql/schema";
import { CORTEX_ENV } from "./env";

let client: SuiGraphQLClient | undefined;
function gql(): SuiGraphQLClient {
  if (!client) {
    client = new SuiGraphQLClient({
      url: CORTEX_ENV.suiGraphql,
      network: CORTEX_ENV.network,
    });
  }
  return client;
}

const OWNED_QUERY = graphql(`
  query Owned($owner: SuiAddress!, $type: String!) {
    address(address: $owner) {
      objects(filter: { type: $type }) {
        nodes {
          address
          contents {
            json
          }
        }
      }
    }
  }
`);

const OBJECT_QUERY = graphql(`
  query Obj($id: SuiAddress!) {
    object(address: $id) {
      asMoveObject {
        contents {
          json
        }
      }
    }
  }
`);

const EVENTS_QUERY = graphql(`
  query Events($type: String!) {
    events(filter: { type: $type }) {
      nodes {
        sender {
          address
        }
        contents {
          json
        }
      }
    }
  }
`);

export interface OwnedObject {
  id: string;
  json: Record<string, unknown>;
}

interface OwnedResult {
  address?: {
    objects?: {
      nodes?: { address: string; contents?: { json?: unknown } }[];
    };
  };
}

interface ObjectResult {
  object?: { asMoveObject?: { contents?: { json?: unknown } } };
}

interface EventsResult {
  events?: {
    nodes?: {
      sender?: { address?: string } | null;
      contents?: { json?: unknown } | null;
    }[];
  };
}

export interface ModuleEvent {
  sender: string;
  json: Record<string, unknown>;
}

export async function ownedObjects(
  owner: string,
  type: string,
): Promise<OwnedObject[]> {
  const res = await gql().query({
    query: OWNED_QUERY,
    variables: { owner, type },
  });
  const data = res.data as OwnedResult | undefined;
  const nodes = data?.address?.objects?.nodes ?? [];
  return nodes.map((n) => ({
    id: n.address,
    json: (n.contents?.json ?? {}) as Record<string, unknown>,
  }));
}

export async function objectJson(
  id: string,
): Promise<Record<string, unknown> | null> {
  const res = await gql().query({ query: OBJECT_QUERY, variables: { id } });
  const data = res.data as ObjectResult | undefined;
  const json = data?.object?.asMoveObject?.contents?.json;
  return json ? (json as Record<string, unknown>) : null;
}

// Events of one fully-qualified Move type (e.g. `${pkg}::sharing::ShareCreated`),
// returning each event's sender address and its payload decoded as JSON. Callers filter
// on the JSON fields. Move struct fields arrive as plain JSON (no `.fields`).
const EVENT_BY_SENDER_QUERY = graphql(`
  query EventBySender($type: String!, $sender: SuiAddress!) {
    events(first: 1, filter: { type: $type, sender: $sender }) {
      nodes {
        contents {
          json
        }
      }
    }
  }
`);

// The decoded payload of the first event of a type emitted by a given sender, or
// null if none. Used to recover an owner -> object mapping from a permanent
// creation event (e.g. MemWal's AccountCreated) when the object itself is shared
// and so can't be found by an owned-objects read.
export async function firstEventBySender(
  eventType: string,
  sender: string,
): Promise<Record<string, unknown> | null> {
  const res = await gql().query({
    query: EVENT_BY_SENDER_QUERY,
    variables: { type: eventType, sender },
  });
  const data = res.data as EventsResult | undefined;
  const json = data?.events?.nodes?.[0]?.contents?.json;
  return json ? (json as Record<string, unknown>) : null;
}

// Every event of a type emitted by a given sender, each decoded as JSON. Mirrors
// EVENT_BY_SENDER_QUERY but without the `first: 1` cap, so callers can reconstruct a
// full set (e.g. all of a user's MemoryAdded entries) from the on-chain event log.
const EVENTS_BY_SENDER_QUERY = graphql(`
  query EventsBySender($type: String!, $sender: SuiAddress!, $after: String) {
    events(filter: { type: $type, sender: $sender }, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        contents {
          json
        }
      }
    }
  }
`);

interface PagedEventsResult {
  events?: {
    pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
    nodes?: { contents?: { json?: unknown } | null }[];
  };
}

// All events of a type by a sender, paginated to completion. Defensive: returns the
// events gathered so far (or []) on any error, so a transient read never throws.
export async function allEventsBySender(
  eventType: string,
  sender: string,
): Promise<{ json: Record<string, unknown> }[]> {
  const out: { json: Record<string, unknown> }[] = [];
  let after: string | undefined;
  let hasNext = true;
  try {
    while (hasNext) {
      const res = await gql().query({
        query: EVENTS_BY_SENDER_QUERY,
        variables: { type: eventType, sender, after },
      });
      const data = res.data as PagedEventsResult | undefined;
      const nodes = data?.events?.nodes ?? [];
      for (const n of nodes) {
        const json = n.contents?.json;
        if (json) out.push({ json: json as Record<string, unknown> });
      }
      const page = data?.events?.pageInfo;
      hasNext = Boolean(page?.hasNextPage && page.endCursor);
      after = page?.endCursor ?? undefined;
    }
  } catch {
    return out;
  }
  return out;
}

export async function moduleEvents(eventType: string): Promise<ModuleEvent[]> {
  const res = await gql().query({
    query: EVENTS_QUERY,
    variables: { type: eventType },
  });
  const data = res.data as EventsResult | undefined;
  const nodes = data?.events?.nodes ?? [];
  return nodes.map((n) => ({
    sender: n.sender?.address ?? "",
    json: (n.contents?.json ?? {}) as Record<string, unknown>,
  }));
}
