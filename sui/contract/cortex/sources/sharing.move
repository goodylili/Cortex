// Encrypted memory sharing between Cortex users, addressed by SuiNS subnames
// (e.g. `great.cortex.sui`). An owner bundles a CHOSEN subset of their memories,
// Seal-encrypts it under an identity scoped to the share object itself, stores the
// blob on Walrus, and grants named recipients read access. A recipient decrypts the
// bundle as a delegate of THIS share only — never the owner's wider account memory —
// and surfaces those memories in their own brain tagged "shared" with the owner's
// handle as provenance. Per-recipient revocation and a whole-share revoke are
// supported; the Seal policy denies a revoked share to everyone but the owner.
//
// Scoping is the security boundary. The owner reuses one Account across many shares,
// so the encrypted bundle's Seal identity MUST be prefixed with this share's object
// id (enforced in `set_bundle`), and `seal_approve` checks the same prefix. A
// recipient added to one share can therefore only ever unseal that share's blob —
// crafting an account-scoped identity to reach the owner's private memory fails the
// prefix check.
module cortex::sharing;

use std::string::String;
use sui::{clock::Clock, event, vec_map::{Self, VecMap}, vec_set::{Self, VecSet}};
use cortex::{
    account::{Self, Account, Registry},
    seal::SealRef,
    util,
    walrus::WalrusRef,
};

// === Errors ===

const ENotOwner: u64 = 1;
const ESelfShare: u64 = 2;
const ENoAccess: u64 = 3;
const EBadIdentity: u64 = 4;
const EBadScope: u64 = 5;
const EBadHash: u64 = 6;
const ERevoked: u64 = 7;

// === Constants ===

const HASH_LEN: u64 = 32;
const NAME_SUFFIX: vector<u8> = b".cortex.sui";

const STATUS_DRAFT: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_REVOKED: u8 = 2;

// === Structs ===

// A shared bundle of memories. Created in DRAFT (no blob yet) so the owner can read
// back its object id, derive the Seal identity from it, encrypt the chosen memories,
// then attach the result via `set_bundle` (DRAFT -> ACTIVE). A shared object so every
// named recipient can reference it in their own seal_approve transaction.
public struct MemoryShare has key {
    id: UID,
    account_id: ID,
    owner: address,
    owner_handle: String,
    title: String,
    status: u8,
    walrus: Option<WalrusRef>,
    seal: Option<SealRef>,
    content_hash: vector<u8>,
    item_count: u64,
    recipients: VecSet<address>,
    recipient_names: VecMap<address, String>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

// === Events ===

public struct ShareCreated has copy, drop {
    share_id: ID,
    account_id: ID,
    owner: address,
    owner_handle: String,
    title: String,
    timestamp_ms: u64,
}
public struct ShareBundleSet has copy, drop {
    share_id: ID,
    blob_id: u256,
    item_count: u64,
    timestamp_ms: u64,
}
public struct RecipientAdded has copy, drop {
    share_id: ID,
    recipient: address,
    recipient_name: String,
    timestamp_ms: u64,
}

public struct RecipientRemoved has copy, drop { share_id: ID, recipient: address, timestamp_ms: u64 }
public struct ShareRevoked has copy, drop { share_id: ID, timestamp_ms: u64 }

// === Naming ===

// Render a bare handle as its SuiNS subname under the project domain, e.g.
// `great` -> `great.cortex.sui` (the leaf subname minted for the user).
public fun full_name(handle: String): String {
    let mut name = handle;
    name.append(NAME_SUFFIX.to_string());
    name
}

// === Owner operations ===

// Open a new share in DRAFT. The bundle is attached separately because its Seal
// identity is derived from this object's id, which only exists after creation.
public fun create_share(account: &Account, title: String, clock: &Clock, ctx: &mut TxContext) {
    let now_ms = clock.timestamp_ms();
    let owner = account.owner();
    let account_id = object::id(account);
    let owner_handle = full_name(account.handle());

    let share = MemoryShare {
        id: object::new(ctx),
        account_id,
        owner,
        owner_handle,
        title,
        status: STATUS_DRAFT,
        walrus: option::none(),
        seal: option::none(),
        content_hash: vector[],
        item_count: 0,
        recipients: vec_set::empty(),
        recipient_names: vec_map::empty(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let share_id = object::id(&share);

    event::emit(ShareCreated { share_id, account_id, owner, owner_handle, title, timestamp_ms: now_ms });
    transfer::share_object(share);
}

// Attach (or replace) the Seal-encrypted Walrus bundle of the chosen memories and
// flip the share live. The bundle's Seal identity must be prefixed with this share's
// id so recipients can only ever decrypt this share — re-keying with a fresh blob is
// just another call here.
public fun set_bundle(
    share: &mut MemoryShare,
    walrus: WalrusRef,
    seal: SealRef,
    content_hash: vector<u8>,
    item_count: u64,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == share.owner, ENotOwner);
    assert!(share.status != STATUS_REVOKED, ERevoked);
    assert!(content_hash.length() == HASH_LEN, EBadHash);
    let prefix = util::id_bytes(object::id(share));
    let identity = seal.identity();
    assert!(util::bytes_start_with(&identity, &prefix), EBadScope);

    let now_ms = clock.timestamp_ms();
    let blob_id = walrus.blob_id();
    share.walrus = option::some(walrus);
    share.seal = option::some(seal);
    share.content_hash = content_hash;
    share.item_count = item_count;
    share.status = STATUS_ACTIVE;
    share.updated_at_ms = now_ms;
    event::emit(ShareBundleSet { share_id: object::id(share), blob_id, item_count, timestamp_ms: now_ms });
}

// Grant a recipient by raw address with a display name the caller supplies. Used
// when the recipient's address is already known off-chain.
public fun share_with_address(
    share: &mut MemoryShare,
    recipient: address,
    recipient_name: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == share.owner, ENotOwner);
    assert!(recipient != share.owner, ESelfShare);
    add_recipient(share, recipient, recipient_name, clock);
}

// Grant a recipient by their cortex handle, resolved to an address through the
// account registry. The stored display name is the SuiNS subname `<handle>.cortex.sui`.
public fun share_with_handle(
    share: &mut MemoryShare,
    registry: &Registry,
    handle: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == share.owner, ENotOwner);
    let recipient = account::owner_of_handle(registry, handle);
    assert!(recipient != share.owner, ESelfShare);
    add_recipient(share, recipient, full_name(handle), clock);
}

// Revoke a single recipient's access. The share stays live for everyone else.
public fun unshare(share: &mut MemoryShare, recipient: address, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == share.owner, ENotOwner);
    if (util::set_remove(&mut share.recipients, recipient)) {
        let now_ms = clock.timestamp_ms();
        if (share.recipient_names.contains(&recipient)) {
            let (_addr, _name) = share.recipient_names.remove(&recipient);
        };
        share.updated_at_ms = now_ms;
        event::emit(RecipientRemoved { share_id: object::id(share), recipient, timestamp_ms: now_ms });
    };
}

// Retire the whole share. seal_approve then denies every recipient (the owner keeps
// access so they can still inspect or re-key). The owner's original memories are
// untouched — only this shared copy is withdrawn.
public fun revoke(share: &mut MemoryShare, clock: &Clock, ctx: &TxContext) {
    assert!(ctx.sender() == share.owner, ENotOwner);
    let now_ms = clock.timestamp_ms();
    share.status = STATUS_REVOKED;
    share.updated_at_ms = now_ms;
    event::emit(ShareRevoked { share_id: object::id(share), timestamp_ms: now_ms });
}

fun add_recipient(share: &mut MemoryShare, recipient: address, recipient_name: String, clock: &Clock) {
    if (util::set_insert(&mut share.recipients, recipient)) {
        let now_ms = clock.timestamp_ms();
        util::upsert(&mut share.recipient_names, recipient, recipient_name);
        share.updated_at_ms = now_ms;
        event::emit(RecipientAdded { share_id: object::id(share), recipient, recipient_name, timestamp_ms: now_ms });
    };
}

// === Seal policy ===
// The owner always passes; a recipient passes only while the share is ACTIVE. The
// identity must be prefixed with this share's id, so authorization here never leaks
// into the owner's account-scoped blobs.
entry fun seal_approve(id: vector<u8>, share: &MemoryShare, ctx: &TxContext) {
    let caller = ctx.sender();
    let allowed =
        caller == share.owner ||
        (share.status == STATUS_ACTIVE && share.recipients.contains(&caller));
    assert!(allowed, ENoAccess);
    let prefix = util::id_bytes(object::id(share));
    assert!(util::bytes_start_with(&id, &prefix), EBadIdentity);
}

// === Views ===

public fun share_owner(share: &MemoryShare): address { share.owner }
public fun share_account(share: &MemoryShare): ID { share.account_id }
public fun owner_handle(share: &MemoryShare): String { share.owner_handle }
public fun title(share: &MemoryShare): String { share.title }
public fun status(share: &MemoryShare): u8 { share.status }
public fun item_count(share: &MemoryShare): u64 { share.item_count }
public fun content_hash(share: &MemoryShare): vector<u8> { share.content_hash }
public fun share_walrus(share: &MemoryShare): Option<WalrusRef> { share.walrus }
public fun share_seal(share: &MemoryShare): Option<SealRef> { share.seal }
public fun has_bundle(share: &MemoryShare): bool { share.walrus.is_some() }
public fun is_active(share: &MemoryShare): bool { share.status == STATUS_ACTIVE }
public fun recipient_count(share: &MemoryShare): u64 { share.recipients.length() }
public fun is_recipient(share: &MemoryShare, who: address): bool { share.recipients.contains(&who) }
public fun recipient_name(share: &MemoryShare, who: address): Option<String> {
    share.recipient_names.try_get(&who)
}
public fun can_access(share: &MemoryShare, who: address): bool {
    who == share.owner || (share.status == STATUS_ACTIVE && share.recipients.contains(&who))
}

public fun status_draft(): u8 { STATUS_DRAFT }
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_revoked(): u8 { STATUS_REVOKED }

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, share: &MemoryShare, ctx: &TxContext) {
    seal_approve(id, share, ctx);
}
