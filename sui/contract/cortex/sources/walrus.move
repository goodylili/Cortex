module cortex::walrus;

use std::string::String;
use sui::{clock::Clock, event, vec_set::{Self, VecSet}};
use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account},
    seal::SealRef,
    util,
};

const EEmptyBlob: u64 = 1;
const EUnknownEncoding: u64 = 2;
const EEpochNotLater: u64 = 3;
const ENotOwner: u64 = 4;
const ENoAccess: u64 = 5;
const EBadIdentity: u64 = 6;
const ESelfDelegate: u64 = 7;
const EBadHash: u64 = 8;

const ENCODING_RS2: u8 = 0;
const ENCODING_COUNT: u8 = 1;

const HASH_LEN: u64 = 32;

public struct WalrusRef has store, copy, drop {
    blob_id: u256,
    size: u64,
    end_epoch: u32,
    encoding: u8,
}

public struct KbFile has key {
    id: UID,
    account_id: ID,
    owner: address,
    name: String,
    mime: String,
    walrus: WalrusRef,
    seal: SealRef,
    content_hash: vector<u8>,
    delegates: VecSet<address>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

public struct KbFileAdded has copy, drop {
    account_id: ID,
    kb_file_id: ID,
    owner: address,
    name: String,
    blob_id: u256,
    timestamp_ms: u64,
}

public struct KbFileRenewed has copy, drop { kb_file_id: ID, end_epoch: u32, timestamp_ms: u64 }
public struct KbAccessGranted has copy, drop { kb_file_id: ID, delegate: address, timestamp_ms: u64 }
public struct KbAccessRevoked has copy, drop { kb_file_id: ID, delegate: address, timestamp_ms: u64 }

public fun new_ref(blob_id: u256, size: u64, end_epoch: u32, encoding: u8): WalrusRef {
    assert!(size > 0, EEmptyBlob);
    assert!(encoding < ENCODING_COUNT, EUnknownEncoding);
    WalrusRef { blob_id, size, end_epoch, encoding }
}

public fun blob_id(self: &WalrusRef): u256 { self.blob_id }
public fun size(self: &WalrusRef): u64 { self.size }
public fun end_epoch(self: &WalrusRef): u32 { self.end_epoch }
public fun encoding(self: &WalrusRef): u8 { self.encoding }
public fun default_encoding(): u8 { ENCODING_RS2 }

public fun is_expired(self: &WalrusRef, current_epoch: u32): bool { self.end_epoch <= current_epoch }
public fun epochs_remaining(self: &WalrusRef, current_epoch: u32): u32 {
    if (self.end_epoch > current_epoch) self.end_epoch - current_epoch else 0
}

public fun add_kb_file(
    account: &mut Account,
    name: String,
    mime: String,
    walrus: WalrusRef,
    seal: SealRef,
    content_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(content_hash.length() == HASH_LEN, EBadHash);
    let now_ms = clock.timestamp_ms();
    let owner = account.owner();
    let account_id = object::id(account);
    let blob_id = walrus.blob_id();

    let kb = KbFile {
        id: object::new(ctx),
        account_id,
        owner,
        name,
        mime,
        walrus,
        seal,
        content_hash,
        delegates: vec_set::empty(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let kb_file_id = object::id(&kb);
    account::link_kb_file(account, kb_file_id, now_ms);

    event::emit(KbFileAdded { account_id, kb_file_id, owner, name, blob_id, timestamp_ms: now_ms });
    transfer::share_object(kb);
}

public fun renew(kb: &mut KbFile, new_end_epoch: u32, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == kb.owner, ENotOwner);
    assert!(new_end_epoch > kb.walrus.end_epoch, EEpochNotLater);
    let now_ms = clock.timestamp_ms();
    kb.walrus.end_epoch = new_end_epoch;
    kb.updated_at_ms = now_ms;
    event::emit(KbFileRenewed { kb_file_id: object::id(kb), end_epoch: new_end_epoch, timestamp_ms: now_ms });
}

public fun grant_access(kb: &mut KbFile, delegate: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == kb.owner, ENotOwner);
    assert!(delegate != kb.owner, ESelfDelegate);
    if (util::set_insert(&mut kb.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        kb.updated_at_ms = now_ms;
        event::emit(KbAccessGranted { kb_file_id: object::id(kb), delegate, timestamp_ms: now_ms });
    };
}

public fun revoke_access(kb: &mut KbFile, delegate: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == kb.owner, ENotOwner);
    if (util::set_remove(&mut kb.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        kb.updated_at_ms = now_ms;
        event::emit(KbAccessRevoked { kb_file_id: object::id(kb), delegate, timestamp_ms: now_ms });
    };
}

// === Executor-gated engine operations ===
// The off-chain engine (the MCP service wallet, holding an ExecutorCap) manages
// access and storage lifetime on a user's shared KbFiles without being the owner.
// Each is gated by access::assert_executor, so a revoked engine cap is rejected.

public fun executor_grant_access(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    kb: &mut KbFile,
    delegate: address,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    assert!(delegate != kb.owner, ESelfDelegate);
    if (util::set_insert(&mut kb.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        kb.updated_at_ms = now_ms;
        event::emit(KbAccessGranted { kb_file_id: object::id(kb), delegate, timestamp_ms: now_ms });
    };
}

public fun executor_revoke_access(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    kb: &mut KbFile,
    delegate: address,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    if (util::set_remove(&mut kb.delegates, delegate)) {
        let now_ms = clock.timestamp_ms();
        kb.updated_at_ms = now_ms;
        event::emit(KbAccessRevoked { kb_file_id: object::id(kb), delegate, timestamp_ms: now_ms });
    };
}

public fun executor_renew(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    kb: &mut KbFile,
    new_end_epoch: u32,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    assert!(new_end_epoch > kb.walrus.end_epoch, EEpochNotLater);
    let now_ms = clock.timestamp_ms();
    kb.walrus.end_epoch = new_end_epoch;
    kb.updated_at_ms = now_ms;
    event::emit(KbFileRenewed { kb_file_id: object::id(kb), end_epoch: new_end_epoch, timestamp_ms: now_ms });
}

entry fun seal_approve(id: vector<u8>, kb: &KbFile, ctx: &TxContext) {
    let caller = ctx.sender();
    assert!(caller == kb.owner || kb.delegates.contains(&caller), ENoAccess);
    let prefix = util::id_bytes(kb.account_id);
    assert!(util::bytes_start_with(&id, &prefix), EBadIdentity);
}

public fun kb_account(kb: &KbFile): ID { kb.account_id }
public fun kb_owner(kb: &KbFile): address { kb.owner }
public fun kb_name(kb: &KbFile): String { kb.name }
public fun kb_mime(kb: &KbFile): String { kb.mime }
public fun kb_walrus(kb: &KbFile): WalrusRef { kb.walrus }
public fun kb_seal(kb: &KbFile): SealRef { kb.seal }
public fun kb_content_hash(kb: &KbFile): vector<u8> { kb.content_hash }
public fun kb_delegate_count(kb: &KbFile): u64 { kb.delegates.length() }
public fun kb_can_access(kb: &KbFile, who: address): bool {
    who == kb.owner || kb.delegates.contains(&who)
}
