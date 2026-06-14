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
