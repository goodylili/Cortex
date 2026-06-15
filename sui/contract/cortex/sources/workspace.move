module cortex::workspace;

use std::string::String;
use sui::{clock::Clock, event, vec_set::{Self, VecSet}};
use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account},
    util,
};

const ENotOwner: u64 = 1;
const ENoAccess: u64 = 2;
const EBadIdentity: u64 = 3;

// A shared agent workspace: a task-board + message-bus pair of Walrus blob
// pointers tied to a Cortex Account. Writable by the owner or an authorized
// executor (the MCP service wallet, holding an ExecutorCap); decryptable via
// Seal by the owner or any delegate the owner grants.
public struct Workspace has key {
    id: UID,
    account_id: ID,
    owner: address,
    tasks_blob: String,
    bus_blob: String,
    loops_blob: String,
    delegates: VecSet<address>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

public struct WorkspaceCreated has copy, drop { workspace_id: ID, account_id: ID, owner: address }
public struct WorkspaceTasksSet has copy, drop { workspace_id: ID, timestamp_ms: u64 }
public struct WorkspaceBusSet has copy, drop { workspace_id: ID, timestamp_ms: u64 }
public struct WorkspaceLoopsSet has copy, drop { workspace_id: ID, timestamp_ms: u64 }
public struct DelegateGranted has copy, drop { workspace_id: ID, delegate: address, timestamp_ms: u64 }
public struct DelegateRevoked has copy, drop { workspace_id: ID, delegate: address, timestamp_ms: u64 }

public fun create_workspace(account: &Account, clock: &Clock, ctx: &mut TxContext) {
    let now_ms = clock.timestamp_ms();
    let account_id = object::id(account);
    let owner = account.owner();

    let ws = Workspace {
        id: object::new(ctx),
        account_id,
        owner,
        tasks_blob: b"".to_string(),
        bus_blob: b"".to_string(),
        loops_blob: b"".to_string(),
        delegates: vec_set::empty(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let workspace_id = object::id(&ws);

    event::emit(WorkspaceCreated { workspace_id, account_id, owner });
    transfer::share_object(ws);
}

public fun grant_delegate(ws: &mut Workspace, delegate: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == ws.owner, ENotOwner);
    if (util::set_insert(&mut ws.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        ws.updated_at_ms = now_ms;
        event::emit(DelegateGranted { workspace_id: object::id(ws), delegate, timestamp_ms: now_ms });
    };
}

public fun revoke_delegate(ws: &mut Workspace, delegate: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == ws.owner, ENotOwner);
    if (util::set_remove(&mut ws.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        ws.updated_at_ms = now_ms;
        event::emit(DelegateRevoked { workspace_id: object::id(ws), delegate, timestamp_ms: now_ms });
    };
}

public fun owner_set_tasks(ws: &mut Workspace, blob: String, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == ws.owner, ENotOwner);
    let now_ms = clock.timestamp_ms();
    ws.tasks_blob = blob;
    ws.updated_at_ms = now_ms;
    event::emit(WorkspaceTasksSet { workspace_id: object::id(ws), timestamp_ms: now_ms });
}

public fun owner_set_bus(ws: &mut Workspace, blob: String, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == ws.owner, ENotOwner);
    let now_ms = clock.timestamp_ms();
    ws.bus_blob = blob;
    ws.updated_at_ms = now_ms;
    event::emit(WorkspaceBusSet { workspace_id: object::id(ws), timestamp_ms: now_ms });
}

public fun owner_set_loops(ws: &mut Workspace, blob: String, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == ws.owner, ENotOwner);
    let now_ms = clock.timestamp_ms();
    ws.loops_blob = blob;
    ws.updated_at_ms = now_ms;
    event::emit(WorkspaceLoopsSet { workspace_id: object::id(ws), timestamp_ms: now_ms });
}

// === Executor-gated engine operations ===
// The off-chain engine (the MCP service wallet, holding an ExecutorCap) writes
// task-board and message-bus pointers on a user's shared Workspace without being
// the owner. Gated by access::assert_executor, so a revoked engine cap is rejected.

public fun executor_set_tasks(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    ws: &mut Workspace,
    blob: String,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    let now_ms = clock.timestamp_ms();
    ws.tasks_blob = blob;
    ws.updated_at_ms = now_ms;
    event::emit(WorkspaceTasksSet { workspace_id: object::id(ws), timestamp_ms: now_ms });
}

public fun executor_set_bus(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    ws: &mut Workspace,
    blob: String,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    let now_ms = clock.timestamp_ms();
    ws.bus_blob = blob;
    ws.updated_at_ms = now_ms;
    event::emit(WorkspaceBusSet { workspace_id: object::id(ws), timestamp_ms: now_ms });
}

public fun executor_set_loops(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    ws: &mut Workspace,
    blob: String,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    let now_ms = clock.timestamp_ms();
    ws.loops_blob = blob;
    ws.updated_at_ms = now_ms;
    event::emit(WorkspaceLoopsSet { workspace_id: object::id(ws), timestamp_ms: now_ms });
}

// Seal policy: the owner or any delegate may unseal workspace-scoped identities
// (those prefixed with this workspace's id). Mirrors walrus::seal_approve.
entry fun seal_approve(id: vector<u8>, ws: &Workspace, ctx: &TxContext) {
    let caller = ctx.sender();
    assert!(caller == ws.owner || ws.delegates.contains(&caller), ENoAccess);
    let prefix = util::id_bytes(object::id(ws));
    assert!(util::bytes_start_with(&id, &prefix), EBadIdentity);
}

public fun ws_owner(ws: &Workspace): address { ws.owner }
public fun ws_account(ws: &Workspace): ID { ws.account_id }
public fun tasks_blob(ws: &Workspace): String { ws.tasks_blob }
public fun bus_blob(ws: &Workspace): String { ws.bus_blob }
public fun loops_blob(ws: &Workspace): String { ws.loops_blob }
public fun is_delegate(ws: &Workspace, addr: address): bool { ws.delegates.contains(&addr) }
public fun can_access(ws: &Workspace, addr: address): bool {
    addr == ws.owner || ws.delegates.contains(&addr)
}

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, ws: &Workspace, ctx: &TxContext) {
    seal_approve(id, ws, ctx);
}
