# Teams on-chain deployment

The `teams` package is a **standalone** Move package for organization-scale,
encrypted memory sharing. It is separate from `cortex` on purpose: shipping Teams
must never require upgrading the deployed `cortex` package. Teams depends on
`cortex` only as an on-chain dependency, reusing its `account::Account` /
`account::Registry` identity primitives and its `access::ExecutorCap` gate; it
never modifies or re-publishes `cortex`.

- Module: `teams::team` (file `sources/team.move`)
- Dependency: `cortex` (local path `../cortex`, resolved to the published package
  per environment via `cortex`'s `Published.toml`)
- Tests: `sui move test` — 16 passing

## What it exposes

- `Team` — a shared object: owner, `name`, members (`VecSet<address>` + per-member
  role in `member_roles`), and two Walrus blob pointers (`feed_blob`, the team chat
  / handoff log; `memory_blob`, the pooled memory index). Both blobs are
  Seal-encrypted under a team-scoped identity.
- Membership: `create_team`, `add_member_by_address`, `add_member_by_handle`
  (resolves a cortex handle via `account::Registry`), `remove_member`, `set_role`.
- Writes: `set_feed_blob` / `set_memory_blob` (any active member) and
  `executor_set_feed` / `executor_set_memory` (the MCP service wallet holding an
  `ExecutorCap`, so a member can reference team memory from any MCP surface).
- `seal_approve` — the Seal policy: the owner always passes; any other member only
  while the team is `ACTIVE`; the decryption identity must be prefixed with the
  team's object id (membership is the security boundary).

## Publish

The teams package is not yet published. To publish (mirrors the cortex flow):

```sh
cd backend/sui/contract/teams
sui move build
sui client publish --gas-budget 200000000
```

After publishing, record the package id and wire the frontend env:

- `NEXT_PUBLIC_CORTEX_TEAMS_PACKAGE_ID_MAINNET`
- `NEXT_PUBLIC_CORTEX_TEAMS_PACKAGE_ID_TESTNET`

The same MCP executor wallet that holds the cortex `ExecutorCap` also authorizes
`executor_set_feed` / `executor_set_memory`, so no new capability needs minting.
