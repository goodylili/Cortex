module cortex::memory;

use std::string::String;
use sui::{clock::Clock, event, vec_set::{Self, VecSet}};
use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account},
    walrus::WalrusRef,
    seal::SealRef,
    util,
};

const ENotOwner: u64 = 4;
const ENoAccess: u64 = 5;
const EBadIdentity: u64 = 6;
const ESelfDelegate: u64 = 7;
const EBadHash: u64 = 8;

const HASH_LEN: u64 = 32;

public struct MemoryEntry has key {
    id: UID,
    account_id: ID,
    owner: address,
    walrus: WalrusRef,
    seal: SealRef,
    content_hash: vector<u8>,
    facet: String,
    tags: vector<String>,
    delegates: VecSet<address>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

public struct MemoryAdded has copy, drop {
    account_id: ID,
    entry_id: ID,
    owner: address,
    facet: String,
    blob_id: u256,
    timestamp_ms: u64,
}

public struct MemoryRemoved has copy, drop { entry_id: ID, owner: address, timestamp_ms: u64 }
public struct MemoryAccessGranted has copy, drop { entry_id: ID, delegate: address, timestamp_ms: u64 }
public struct MemoryAccessRevoked has copy, drop { entry_id: ID, delegate: address, timestamp_ms: u64 }

public fun add_memory(
    account: &Account,
    walrus: WalrusRef,
    seal: SealRef,
    content_hash: vector<u8>,
    facet: String,
    tags: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(content_hash.length() == HASH_LEN, EBadHash);
    let now_ms = clock.timestamp_ms();
    let owner = account.owner();
    let account_id = object::id(account);
    let blob_id = walrus.blob_id();

    let entry = MemoryEntry {
        id: object::new(ctx),
        account_id,
        owner,
        walrus,
        seal,
        content_hash,
        facet,
        tags,
        delegates: vec_set::empty(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let entry_id = object::id(&entry);

    event::emit(MemoryAdded { account_id, entry_id, owner, facet, blob_id, timestamp_ms: now_ms });
    transfer::share_object(entry);
}

public fun grant_access(entry: &mut MemoryEntry, delegate: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == entry.owner, ENotOwner);
    assert!(delegate != entry.owner, ESelfDelegate);
    if (util::set_insert(&mut entry.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        entry.updated_at_ms = now_ms;
        event::emit(MemoryAccessGranted { entry_id: object::id(entry), delegate, timestamp_ms: now_ms });
    };
}

public fun revoke_access(entry: &mut MemoryEntry, delegate: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == entry.owner, ENotOwner);
    if (util::set_remove(&mut entry.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        entry.updated_at_ms = now_ms;
        event::emit(MemoryAccessRevoked { entry_id: object::id(entry), delegate, timestamp_ms: now_ms });
    };
}

// === Executor-gated engine operations ===
// The off-chain engine (the MCP service wallet, holding an ExecutorCap) manages
// access on a user's shared MemoryEntries without being the owner. Each is gated by
// access::assert_executor, so a revoked engine cap is rejected.

public fun executor_grant_access(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    entry: &mut MemoryEntry,
    delegate: address,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    assert!(delegate != entry.owner, ESelfDelegate);
    if (util::set_insert(&mut entry.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        entry.updated_at_ms = now_ms;
        event::emit(MemoryAccessGranted { entry_id: object::id(entry), delegate, timestamp_ms: now_ms });
    };
}

public fun executor_revoke_access(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    entry: &mut MemoryEntry,
    delegate: address,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    if (util::set_remove(&mut entry.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        entry.updated_at_ms = now_ms;
        event::emit(MemoryAccessRevoked { entry_id: object::id(entry), delegate, timestamp_ms: now_ms });
    };
}

public fun remove_memory(entry: MemoryEntry, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == entry.owner, ENotOwner);
    let now_ms = clock.timestamp_ms();
    event::emit(MemoryRemoved { entry_id: object::id(&entry), owner: entry.owner, timestamp_ms: now_ms });
    let MemoryEntry {
        id,
        account_id: _,
        owner: _,
        walrus: _,
        seal: _,
        content_hash: _,
        facet: _,
        tags: _,
        delegates: _,
        created_at_ms: _,
        updated_at_ms: _,
    } = entry;
    object::delete(id);
}

entry fun seal_approve(id: vector<u8>, entry: &MemoryEntry, ctx: &TxContext) {
    let caller = ctx.sender();
    assert!(caller == entry.owner || entry.delegates.contains(&caller), ENoAccess);
    let prefix = util::id_bytes(entry.account_id);
    assert!(util::bytes_start_with(&id, &prefix), EBadIdentity);
}

public fun memory_account(entry: &MemoryEntry): ID { entry.account_id }
public fun memory_owner(entry: &MemoryEntry): address { entry.owner }
public fun memory_walrus(entry: &MemoryEntry): WalrusRef { entry.walrus }
public fun memory_seal(entry: &MemoryEntry): SealRef { entry.seal }
public fun memory_facet(entry: &MemoryEntry): String { entry.facet }
public fun memory_tags(entry: &MemoryEntry): vector<String> { entry.tags }
public fun memory_content_hash(entry: &MemoryEntry): vector<u8> { entry.content_hash }
public fun memory_delegate_count(entry: &MemoryEntry): u64 { entry.delegates.length() }
public fun memory_can_access(entry: &MemoryEntry, who: address): bool {
    who == entry.owner || entry.delegates.contains(&who)
}
