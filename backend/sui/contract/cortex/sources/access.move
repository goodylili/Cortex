module cortex::access;

use sui::{clock::Clock, event, table::{Self, Table}};

// === Errors ===

const EExecutorRevoked: u64 = 1;
const EAdminRevoked: u64 = 2;

// === Capabilities ===

/// Held by the platform operator. Authorizes onboarding on behalf of users, cap
/// rotation, and emergency reactivation.
public struct AdminCap has key, store {
    id: UID,
}

/// Held by the off-chain execution engine — in Cortex, the MCP service wallet.
/// Authorizes acting on shared state (managing memory/KB access, writing agent
/// workspace pointers) on a user's behalf. Treated as hot and rotated often.
public struct ExecutorCap has key, store {
    id: UID,
}

// === Registry ===

/// Shared singleton holding the set of revoked `ExecutorCap` IDs and revoked
/// `AdminCap` IDs. Every gated function reads this via `assert_executor` /
/// `assert_admin` and aborts if its cap's ID is present, so a rogue or
/// compromised cap can be disabled by ID without the holder surrendering it.
/// Created once in `init`; there is intentionally NO public constructor, so a
/// second/empty registry can never be substituted to bypass the check.
public struct AccessRegistry has key {
    id: UID,
    revoked: Table<ID, bool>,
    revoked_admins: Table<ID, bool>,
}

// === Events ===

public struct AccessRegistryCreated has copy, drop { registry_id: ID }
public struct ExecutorCapMinted has copy, drop { cap_id: ID, recipient: address }
public struct AdminCapMinted has copy, drop { cap_id: ID, recipient: address }

public struct ExecutorCapRevoked has copy, drop {
    registry_id: ID,
    cap_id: ID,
    revoked_by: address,
    timestamp_ms: u64,
}
public struct ExecutorCapRestored has copy, drop {
    registry_id: ID,
    cap_id: ID,
    restored_by: address,
    timestamp_ms: u64,
}
public struct AdminCapRevoked has copy, drop {
    registry_id: ID,
    cap_id: ID,
    revoked_by: address,
    timestamp_ms: u64,
}
public struct AdminCapRestored has copy, drop {
    registry_id: ID,
    cap_id: ID,
    restored_by: address,
    timestamp_ms: u64,
}

// === Init ===

/// Runs once when this module is first published (including as a new module in a
/// package upgrade). Mints one AdminCap and one ExecutorCap to the publisher and
/// creates the shared access registry that gates both.
fun init(ctx: &mut TxContext) {
    let admin = ctx.sender();

    let admin_cap = AdminCap { id: object::new(ctx) };
    event::emit(AdminCapMinted { cap_id: object::id(&admin_cap), recipient: admin });
    transfer::transfer(admin_cap, admin);

    let executor_cap = ExecutorCap { id: object::new(ctx) };
    event::emit(ExecutorCapMinted { cap_id: object::id(&executor_cap), recipient: admin });
    transfer::transfer(executor_cap, admin);

    let registry = AccessRegistry {
        id: object::new(ctx),
        revoked: table::new(ctx),
        revoked_admins: table::new(ctx),
    };
    event::emit(AccessRegistryCreated { registry_id: object::id(&registry) });
    transfer::share_object(registry);
}

// === Cap management ===

/// Mints an additional AdminCap to a recipient. Only a non-revoked admin can.
public fun new_admin_cap(
    cap: &AdminCap,
    registry: &AccessRegistry,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert_admin(registry, cap);
    let new_cap = AdminCap { id: object::new(ctx) };
    event::emit(AdminCapMinted { cap_id: object::id(&new_cap), recipient });
    transfer::transfer(new_cap, recipient);
}

/// Mints an additional ExecutorCap to a recipient — used to rotate the engine's
/// key: mint a new cap for the new key, then burn or revoke the old one.
public fun new_executor_cap(
    cap: &AdminCap,
    registry: &AccessRegistry,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert_admin(registry, cap);
    let new_cap = ExecutorCap { id: object::new(ctx) };
    event::emit(ExecutorCapMinted { cap_id: object::id(&new_cap), recipient });
    transfer::transfer(new_cap, recipient);
}

/// Permanently destroys an ExecutorCap you hold (cooperative rotation). For a cap
/// the admin cannot reach, use `revoke_executor_cap` instead.
public fun burn_executor_cap(cap: ExecutorCap) {
    let ExecutorCap { id } = cap;
    id.delete();
}

// === Executor revocation ===

/// Revokes an ExecutorCap by object ID — no need for the holder to sign. Every
/// executor-gated function checks this set. Idempotent.
public fun revoke_executor_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (!registry.revoked.contains(cap_id)) {
        registry.revoked.add(cap_id, true);
    };
    event::emit(ExecutorCapRevoked {
        registry_id: object::id(registry),
        cap_id,
        revoked_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Removes an ExecutorCap ID from the blacklist, re-enabling it. Idempotent.
public fun restore_executor_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (registry.revoked.contains(cap_id)) {
        registry.revoked.remove(cap_id);
    };
    event::emit(ExecutorCapRestored {
        registry_id: object::id(registry),
        cap_id,
        restored_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Admin revocation ===

/// Revokes an AdminCap by object ID. A compromised admin can be disabled by ID
/// without surrendering the cap. An admin can revoke any admin (including itself);
/// guard the last live cap off-chain. Idempotent.
public fun revoke_admin_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (!registry.revoked_admins.contains(cap_id)) {
        registry.revoked_admins.add(cap_id, true);
    };
    event::emit(AdminCapRevoked {
        registry_id: object::id(registry),
        cap_id,
        revoked_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

/// Removes an AdminCap ID from the admin blacklist, re-enabling it. Idempotent.
public fun restore_admin_cap(
    cap: &AdminCap,
    registry: &mut AccessRegistry,
    cap_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert_admin(registry, cap);
    if (registry.revoked_admins.contains(cap_id)) {
        registry.revoked_admins.remove(cap_id);
    };
    event::emit(AdminCapRestored {
        registry_id: object::id(registry),
        cap_id,
        restored_by: ctx.sender(),
        timestamp_ms: clock.timestamp_ms(),
    });
}

// === Gates ===

/// Aborts `EExecutorRevoked` if `cap`'s ID is blacklisted. The first line of every
/// executor-gated function. Read-only — no write contention on the registry.
public fun assert_executor(registry: &AccessRegistry, cap: &ExecutorCap) {
    assert!(!registry.revoked.contains(object::id(cap)), EExecutorRevoked);
}

public fun is_executor_revoked(registry: &AccessRegistry, cap_id: ID): bool {
    registry.revoked.contains(cap_id)
}

/// Aborts `EAdminRevoked` if `cap`'s ID is blacklisted. The first line of every
/// admin-gated function.
public fun assert_admin(registry: &AccessRegistry, cap: &AdminCap) {
    assert!(!registry.revoked_admins.contains(object::id(cap)), EAdminRevoked);
}

public fun is_admin_revoked(registry: &AccessRegistry, cap_id: ID): bool {
    registry.revoked_admins.contains(cap_id)
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun mint_executor_cap_for_testing(ctx: &mut TxContext): ExecutorCap {
    ExecutorCap { id: object::new(ctx) }
}

#[test_only]
public fun mint_admin_cap_for_testing(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}
