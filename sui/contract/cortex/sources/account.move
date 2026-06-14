module cortex::account;

use std::string::String;

use sui::{
    clock::Clock,
    event,
    table::{Self, Table},
    vec_map::{Self, VecMap},
    vec_set::{Self, VecSet},
};

use cortex::util;

const EAlreadyRegistered: u64 = 1;
const EHandleTaken: u64 = 2;
const ENotRegistered: u64 = 3;
const EUnknownSetting: u64 = 4;

public struct Profile has store, copy, drop {
    display_name: String,
    handle: String,
    bio: String,
    avatar_blob: Option<u256>,
}

public struct Account has key {
    id: UID,
    owner: address,
    memwal_account_id: ID,
    profile: Profile,
    settings: VecMap<String, String>,
    agents: VecSet<ID>,
    kb_files: VecSet<ID>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

public struct Registry has key {
    id: UID,
    accounts: Table<address, ID>,
    handles: Table<String, address>,
    total_accounts: u64,
}

public struct RegistryCreated has copy, drop { registry_id: ID }

public struct AccountRegistered has copy, drop {
    account_id: ID,
    owner: address,
    handle: String,
    memwal_account_id: ID,
    timestamp_ms: u64,
}

public struct ProfileUpdated has copy, drop { account_id: ID, timestamp_ms: u64 }
public struct HandleChanged has copy, drop { account_id: ID, previous: String, current: String, timestamp_ms: u64 }
public struct AvatarSet has copy, drop { account_id: ID, blob_id: u256, timestamp_ms: u64 }
public struct SettingSet has copy, drop { account_id: ID, key: String, timestamp_ms: u64 }
public struct SettingRemoved has copy, drop { account_id: ID, key: String, timestamp_ms: u64 }
public struct MemwalLinked has copy, drop { account_id: ID, memwal_account_id: ID, timestamp_ms: u64 }
public struct AgentLinked has copy, drop { account_id: ID, agent_id: ID, timestamp_ms: u64 }
public struct AgentUnlinked has copy, drop { account_id: ID, agent_id: ID, timestamp_ms: u64 }
public struct KbFileLinked has copy, drop { account_id: ID, kb_file_id: ID, timestamp_ms: u64 }
public struct KbFileUnlinked has copy, drop { account_id: ID, kb_file_id: ID, timestamp_ms: u64 }

fun init(ctx: &mut TxContext) {
    let registry = Registry {
        id: object::new(ctx),
        accounts: table::new(ctx),
        handles: table::new(ctx),
        total_accounts: 0,
    };
    event::emit(RegistryCreated { registry_id: object::id(&registry) });
    transfer::share_object(registry);
}

entry fun register(
    registry: &mut Registry,
    memwal_account_id: ID,
    display_name: String,
    handle: String,
    bio: String,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let owner = ctx.sender();
    assert!(!registry.accounts.contains(owner), EAlreadyRegistered);
    assert!(!registry.handles.contains(handle), EHandleTaken);
    let now_ms = clock.timestamp_ms();

    let account = Account {
        id: object::new(ctx),
        owner,
        memwal_account_id,
        profile: Profile { display_name, handle, bio, avatar_blob: option::none<u256>() },
        settings: vec_map::empty(),
        agents: vec_set::empty(),
        kb_files: vec_set::empty(),
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let account_id = object::id(&account);

    registry.accounts.add(owner, account_id);
    registry.handles.add(handle, owner);
    registry.total_accounts = registry.total_accounts + 1;

    event::emit(AccountRegistered { account_id, owner, handle, memwal_account_id, timestamp_ms: now_ms });
    transfer::transfer(account, owner);
}

public fun update_profile(account: &mut Account, display_name: String, bio: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    account.profile.display_name = display_name;
    account.profile.bio = bio;
    account.updated_at_ms = now_ms;
    event::emit(ProfileUpdated { account_id: object::id(account), timestamp_ms: now_ms });
}

public fun set_handle(registry: &mut Registry, account: &mut Account, new_handle: String, clock: &Clock) {
    assert!(!registry.handles.contains(new_handle), EHandleTaken);
    let now_ms = clock.timestamp_ms();
    let previous = account.profile.handle;
    registry.handles.remove(previous);
    registry.handles.add(new_handle, account.owner);
    account.profile.handle = new_handle;
    account.updated_at_ms = now_ms;
    event::emit(HandleChanged { account_id: object::id(account), previous, current: new_handle, timestamp_ms: now_ms });
}

public fun set_avatar(account: &mut Account, blob_id: u256, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    account.profile.avatar_blob = option::some(blob_id);
    account.updated_at_ms = now_ms;
    event::emit(AvatarSet { account_id: object::id(account), blob_id, timestamp_ms: now_ms });
}

public fun set_setting(account: &mut Account, key: String, value: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    util::upsert(&mut account.settings, key, value);
    account.updated_at_ms = now_ms;
    event::emit(SettingSet { account_id: object::id(account), key, timestamp_ms: now_ms });
}

public fun remove_setting(account: &mut Account, key: String, clock: &Clock) {
    assert!(account.settings.contains(&key), EUnknownSetting);
    let now_ms = clock.timestamp_ms();
    account.settings.remove(&key);
    account.updated_at_ms = now_ms;
    event::emit(SettingRemoved { account_id: object::id(account), key, timestamp_ms: now_ms });
}

public fun link_memwal(account: &mut Account, memwal_account_id: ID, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    account.memwal_account_id = memwal_account_id;
    account.updated_at_ms = now_ms;
    event::emit(MemwalLinked { account_id: object::id(account), memwal_account_id, timestamp_ms: now_ms });
}

public(package) fun link_agent(account: &mut Account, agent_id: ID, now_ms: u64) {
    if (util::set_insert(&mut account.agents, agent_id)) {
        account.updated_at_ms = now_ms;
        event::emit(AgentLinked { account_id: object::id(account), agent_id, timestamp_ms: now_ms });
    };
}

public(package) fun unlink_agent(account: &mut Account, agent_id: ID, now_ms: u64) {
    if (util::set_remove(&mut account.agents, agent_id)) {
        account.updated_at_ms = now_ms;
        event::emit(AgentUnlinked { account_id: object::id(account), agent_id, timestamp_ms: now_ms });
    };
}

public(package) fun link_kb_file(account: &mut Account, kb_file_id: ID, now_ms: u64) {
    if (util::set_insert(&mut account.kb_files, kb_file_id)) {
        account.updated_at_ms = now_ms;
        event::emit(KbFileLinked { account_id: object::id(account), kb_file_id, timestamp_ms: now_ms });
    };
}

public(package) fun unlink_kb_file(account: &mut Account, kb_file_id: ID, now_ms: u64) {
    if (util::set_remove(&mut account.kb_files, kb_file_id)) {
        account.updated_at_ms = now_ms;
        event::emit(KbFileUnlinked { account_id: object::id(account), kb_file_id, timestamp_ms: now_ms });
    };
}

public fun owner(account: &Account): address { account.owner }
public fun memwal_account_id(account: &Account): ID { account.memwal_account_id }
public fun display_name(account: &Account): String { account.profile.display_name }
public fun handle(account: &Account): String { account.profile.handle }
public fun bio(account: &Account): String { account.profile.bio }
public fun avatar_blob(account: &Account): Option<u256> { account.profile.avatar_blob }
public fun created_at_ms(account: &Account): u64 { account.created_at_ms }
public fun updated_at_ms(account: &Account): u64 { account.updated_at_ms }

public fun setting(account: &Account, key: String): Option<String> {
    account.settings.try_get(&key)
}

public fun agents(account: &Account): VecSet<ID> { account.agents }
public fun has_agent(account: &Account, agent_id: ID): bool { account.agents.contains(&agent_id) }

public fun kb_files(account: &Account): VecSet<ID> { account.kb_files }
public fun has_kb_file(account: &Account, kb_file_id: ID): bool { account.kb_files.contains(&kb_file_id) }

public fun total_accounts(registry: &Registry): u64 { registry.total_accounts }
public fun is_registered(registry: &Registry, owner: address): bool { registry.accounts.contains(owner) }
public fun handle_taken(registry: &Registry, handle: String): bool { registry.handles.contains(handle) }

public fun account_of(registry: &Registry, owner: address): ID {
    assert!(registry.accounts.contains(owner), ENotRegistered);
    *registry.accounts.borrow(owner)
}
