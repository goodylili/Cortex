// Teams: organization-scale encrypted memory sharing on Cortex. An owner opens a
// Team (a shared object), invites members by raw address or by their cortex SuiNS
// handle (e.g. `great.cortex.sui`), and gives each a role. A team keeps two Walrus
// blob pointers  -  a feed (the team chat / handoff log) and a memory index (the
// pooled, referenceable memories)  -  both Seal-encrypted under an identity scoped
// to THIS team's object id. Any active member may read (seal_approve) and write
// those blobs; the MCP service wallet (an ExecutorCap holder) may write on a
// member's behalf, so a member can reference team memory from Asana, Claude, or
// anywhere the Cortex MCP is connected.
//
// Membership is the security boundary. The two blobs share one team-scoped Seal
// identity, so that identity MUST be prefixed with this team's object id (checked in
// seal_approve). A member of one team can therefore never craft an identity to reach
// another team's blobs  -  nor an owner's private, account-scoped account memory,
// which lives under a different package's policy entirely.
//
// This is a standalone package: it depends on the deployed `cortex` package only for
// its Account/Registry identity primitives and its ExecutorCap access gate, and never
// modifies or upgrades it.
module teams::team;

use std::string::String;
use sui::{clock::Clock, event, vec_map::{Self, VecMap}, vec_set::{Self, VecSet}};
use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account, Registry},
};

// === Errors ===

const ENotOwner: u64 = 1;
const ENotAdmin: u64 = 2;
const ENotMember: u64 = 3;
const ENoAccess: u64 = 4;
const EBadIdentity: u64 = 5;
const EOwnerRequired: u64 = 6;
const ESelfAdd: u64 = 7;
const EArchived: u64 = 8;
const EUnknownMember: u64 = 9;
const EBadRole: u64 = 10;

// === Constants ===

const NAME_SUFFIX: vector<u8> = b".cortex.sui";

const STATUS_ACTIVE: u8 = 0;
const STATUS_ARCHIVED: u8 = 1;

const ROLE_MEMBER: u8 = 0;
const ROLE_ADMIN: u8 = 1;

// === Structs ===

// A team: a shared object every member references in their own seal_approve
// transaction. The owner is always a member with ROLE_ADMIN and can never be
// removed or demoted. `feed_blob` and `memory_blob` are Walrus blob ids for the
// team-scoped, Seal-encrypted chat log and pooled memory index; empty until first
// written.
public struct Team has key {
    id: UID,
    owner: address,
    name: String,
    owner_handle: String,
    status: u8,
    members: VecSet<address>,
    member_names: VecMap<address, String>,
    member_roles: VecMap<address, u8>,
    feed_blob: String,
    memory_blob: String,
    created_at_ms: u64,
    updated_at_ms: u64,
}

// === Events ===

public struct TeamCreated has copy, drop {
    team_id: ID,
    owner: address,
    owner_handle: String,
    name: String,
    timestamp_ms: u64,
}
public struct MemberAdded has copy, drop {
    team_id: ID,
    member: address,
    member_name: String,
    role: u8,
    timestamp_ms: u64,
}
public struct MemberRemoved has copy, drop { team_id: ID, member: address, timestamp_ms: u64 }
public struct MemberRoleChanged has copy, drop { team_id: ID, member: address, role: u8, timestamp_ms: u64 }
public struct TeamFeedSet has copy, drop { team_id: ID, timestamp_ms: u64 }
public struct TeamMemorySet has copy, drop { team_id: ID, timestamp_ms: u64 }
public struct TeamArchived has copy, drop { team_id: ID, timestamp_ms: u64 }
public struct TeamReactivated has copy, drop { team_id: ID, timestamp_ms: u64 }

// === Naming ===

// Render a bare handle as its SuiNS subname under the project domain, e.g.
// `great` -> `great.cortex.sui`.
public fun full_name(handle: String): String {
    let mut name = handle;
    name.append(NAME_SUFFIX.to_string());
    name
}

// === Lifecycle ===

// Open a new team. The creator becomes the owner and first member (ROLE_ADMIN).
public fun create_team(account: &Account, name: String, clock: &Clock, ctx: &mut TxContext) {
    let now_ms = clock.timestamp_ms();
    let owner = account.owner();
    let owner_handle = full_name(account.handle());

    let mut members = vec_set::empty();
    members.insert(owner);
    let mut member_names = vec_map::empty();
    member_names.insert(owner, owner_handle);
    let mut member_roles = vec_map::empty();
    member_roles.insert(owner, ROLE_ADMIN);

    let team = Team {
        id: object::new(ctx),
        owner,
        name,
        owner_handle,
        status: STATUS_ACTIVE,
        members,
        member_names,
        member_roles,
        feed_blob: b"".to_string(),
        memory_blob: b"".to_string(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let team_id = object::id(&team);

    event::emit(TeamCreated { team_id, owner, owner_handle, name, timestamp_ms: now_ms });
    transfer::share_object(team);
}

// Archive the team: writes are frozen and seal_approve denies every member but the
// owner, who keeps access to inspect or re-key. No memory is destroyed.
public fun archive_team(team: &mut Team, clock: &Clock, ctx: &TxContext) {
    ensure_owner(team, ctx);
    let now_ms = clock.timestamp_ms();
    team.status = STATUS_ARCHIVED;
    team.updated_at_ms = now_ms;
    event::emit(TeamArchived { team_id: object::id(team), timestamp_ms: now_ms });
}

// Bring an archived team back to life.
public fun reactivate_team(team: &mut Team, clock: &Clock, ctx: &TxContext) {
    ensure_owner(team, ctx);
    let now_ms = clock.timestamp_ms();
    team.status = STATUS_ACTIVE;
    team.updated_at_ms = now_ms;
    event::emit(TeamReactivated { team_id: object::id(team), timestamp_ms: now_ms });
}

// === Membership ===

// Invite a member by raw address with a display name the caller supplies. Any admin
// (or the owner) may invite.
public fun add_member_by_address(
    team: &mut Team,
    member: address,
    member_name: String,
    role: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    ensure_admin(team, ctx);
    assert!(team.status == STATUS_ACTIVE, EArchived);
    assert!(member != team.owner, ESelfAdd);
    assert!(role == ROLE_MEMBER || role == ROLE_ADMIN, EBadRole);
    add_member(team, member, member_name, role, clock);
}

// Invite a member by their cortex handle, resolved to an address through the account
// registry. The stored display name is the SuiNS subname `<handle>.cortex.sui`.
public fun add_member_by_handle(
    team: &mut Team,
    registry: &Registry,
    handle: String,
    role: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    ensure_admin(team, ctx);
    assert!(team.status == STATUS_ACTIVE, EArchived);
    assert!(role == ROLE_MEMBER || role == ROLE_ADMIN, EBadRole);
    let member = account::owner_of_handle(registry, handle);
    assert!(member != team.owner, ESelfAdd);
    add_member(team, member, full_name(handle), role, clock);
}

// Remove a member. The owner cannot be removed.
public fun remove_member(team: &mut Team, member: address, clock: &Clock, ctx: &TxContext) {
    ensure_admin(team, ctx);
    assert!(member != team.owner, EOwnerRequired);
    if (set_remove(&mut team.members, member)) {
        let now_ms = clock.timestamp_ms();
        if (team.member_names.contains(&member)) {
            let (_a, _n) = team.member_names.remove(&member);
        };
        if (team.member_roles.contains(&member)) {
            let (_a2, _r) = team.member_roles.remove(&member);
        };
        team.updated_at_ms = now_ms;
        event::emit(MemberRemoved { team_id: object::id(team), member, timestamp_ms: now_ms });
    };
}

// Change a member's role. Owner-only, and the owner's own role is fixed.
public fun set_role(team: &mut Team, member: address, role: u8, clock: &Clock, ctx: &TxContext) {
    ensure_owner(team, ctx);
    assert!(member != team.owner, EOwnerRequired);
    assert!(team.members.contains(&member), EUnknownMember);
    assert!(role == ROLE_MEMBER || role == ROLE_ADMIN, EBadRole);
    let now_ms = clock.timestamp_ms();
    upsert(&mut team.member_roles, member, role);
    team.updated_at_ms = now_ms;
    event::emit(MemberRoleChanged { team_id: object::id(team), member, role, timestamp_ms: now_ms });
}

fun add_member(team: &mut Team, member: address, member_name: String, role: u8, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    if (!team.members.contains(&member)) {
        team.members.insert(member);
    };
    upsert(&mut team.member_names, member, member_name);
    upsert(&mut team.member_roles, member, role);
    team.updated_at_ms = now_ms;
    event::emit(MemberAdded { team_id: object::id(team), member, member_name, role, timestamp_ms: now_ms });
}

// === Member writes ===
// The feed (team chat / handoff log) and the pooled memory index are single Walrus
// blobs that any active member re-writes off-chain and re-points here. Both are
// Seal-encrypted under the team-scoped identity, so a stored blob id leaks nothing.

public fun set_feed_blob(team: &mut Team, blob: String, clock: &Clock, ctx: &TxContext) {
    assert!(team.status == STATUS_ACTIVE, EArchived);
    ensure_member(team, ctx.sender());
    let now_ms = clock.timestamp_ms();
    team.feed_blob = blob;
    team.updated_at_ms = now_ms;
    event::emit(TeamFeedSet { team_id: object::id(team), timestamp_ms: now_ms });
}

public fun set_memory_blob(team: &mut Team, blob: String, clock: &Clock, ctx: &TxContext) {
    assert!(team.status == STATUS_ACTIVE, EArchived);
    ensure_member(team, ctx.sender());
    let now_ms = clock.timestamp_ms();
    team.memory_blob = blob;
    team.updated_at_ms = now_ms;
    event::emit(TeamMemorySet { team_id: object::id(team), timestamp_ms: now_ms });
}

// === Executor-gated writes ===
// The off-chain engine (the MCP service wallet, holding an ExecutorCap) writes the
// feed or memory index on a member's behalf  -  this is what lets a member reference
// and update team memory from any MCP-connected surface. Gated by
// access::assert_executor, so a revoked cap is rejected.

public fun executor_set_feed(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    team: &mut Team,
    blob: String,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    assert!(team.status == STATUS_ACTIVE, EArchived);
    let now_ms = clock.timestamp_ms();
    team.feed_blob = blob;
    team.updated_at_ms = now_ms;
    event::emit(TeamFeedSet { team_id: object::id(team), timestamp_ms: now_ms });
}

public fun executor_set_memory(
    registry: &AccessRegistry,
    cap: &ExecutorCap,
    team: &mut Team,
    blob: String,
    clock: &Clock,
) {
    access::assert_executor(registry, cap);
    assert!(team.status == STATUS_ACTIVE, EArchived);
    let now_ms = clock.timestamp_ms();
    team.memory_blob = blob;
    team.updated_at_ms = now_ms;
    event::emit(TeamMemorySet { team_id: object::id(team), timestamp_ms: now_ms });
}

// === Seal policy ===
// The owner always passes; any other member passes only while the team is ACTIVE.
// The identity must be prefixed with this team's id, so authorization here never
// leaks into another team's team-scoped blobs.
entry fun seal_approve(id: vector<u8>, team: &Team, ctx: &TxContext) {
    let caller = ctx.sender();
    let allowed =
        caller == team.owner ||
        (team.status == STATUS_ACTIVE && team.members.contains(&caller));
    assert!(allowed, ENoAccess);
    let prefix = id_bytes(object::id(team));
    assert!(bytes_start_with(&id, &prefix), EBadIdentity);
}

// === Views ===

public fun team_owner(team: &Team): address { team.owner }
public fun team_name(team: &Team): String { team.name }
public fun owner_handle(team: &Team): String { team.owner_handle }
public fun status(team: &Team): u8 { team.status }
public fun is_active(team: &Team): bool { team.status == STATUS_ACTIVE }
public fun member_count(team: &Team): u64 { team.members.length() }
public fun is_member(team: &Team, who: address): bool { team.members.contains(&who) }
public fun is_admin(team: &Team, who: address): bool {
    who == team.owner ||
    (team.member_roles.contains(&who) && *team.member_roles.get(&who) == ROLE_ADMIN)
}
public fun member_role(team: &Team, who: address): Option<u8> { team.member_roles.try_get(&who) }
public fun member_name(team: &Team, who: address): Option<String> { team.member_names.try_get(&who) }
public fun feed_blob(team: &Team): String { team.feed_blob }
public fun memory_blob(team: &Team): String { team.memory_blob }
public fun has_feed(team: &Team): bool { !team.feed_blob.is_empty() }
public fun has_memory(team: &Team): bool { !team.memory_blob.is_empty() }
public fun can_access(team: &Team, who: address): bool {
    who == team.owner || (team.status == STATUS_ACTIVE && team.members.contains(&who))
}

public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_archived(): u8 { STATUS_ARCHIVED }
public fun role_member(): u8 { ROLE_MEMBER }
public fun role_admin(): u8 { ROLE_ADMIN }

// === Internal access checks ===

fun ensure_owner(team: &Team, ctx: &TxContext) {
    assert!(ctx.sender() == team.owner, ENotOwner);
}

fun ensure_admin(team: &Team, ctx: &TxContext) {
    assert!(is_admin(team, ctx.sender()), ENotAdmin);
}

fun ensure_member(team: &Team, who: address) {
    assert!(team.members.contains(&who), ENotMember);
}

// === Internal helpers ===
// Self-contained equivalents of cortex::util (which is package-private to cortex).

fun id_bytes(id: ID): vector<u8> {
    id.to_address().to_bytes()
}

fun bytes_start_with(full: &vector<u8>, prefix: &vector<u8>): bool {
    let pl = prefix.length();
    if (full.length() < pl) return false;
    let mut matches = true;
    let mut i = 0;
    while (i < pl) {
        if (*full.borrow(i) != *prefix.borrow(i)) {
            matches = false;
            break
        };
        i = i + 1;
    };
    matches
}

fun set_remove(set: &mut VecSet<address>, key: address): bool {
    if (set.contains(&key)) {
        set.remove(&key);
        true
    } else {
        false
    }
}

fun upsert<V: drop>(map: &mut VecMap<address, V>, key: address, value: V) {
    if (map.contains(&key)) {
        *map.get_mut(&key) = value;
    } else {
        map.insert(key, value);
    }
}

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, team: &Team, ctx: &TxContext) {
    seal_approve(id, team, ctx);
}
