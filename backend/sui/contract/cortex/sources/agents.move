module cortex::agents;

use std::string::String;
use sui::{clock::Clock, event, vec_map::{Self, VecMap}, vec_set::{Self, VecSet}};
use cortex::{account::{Self, Account}, seal::SealRef, util, walrus::WalrusRef};

const EWrongAccount: u64 = 1;
const EUnknownConfig: u64 = 2;
const ENoAccess: u64 = 3;
const EBadIdentity: u64 = 4;

const STATUS_ACTIVE: u8 = 0;
const STATUS_PAUSED: u8 = 1;
const STATUS_ARCHIVED: u8 = 2;

public enum AgentStatus has copy, drop, store {
    Active,
    Paused,
    Archived,
}

// An agent's prompt and description are private usage details, so they are never
// stored on chain in plaintext (everything on Sui is world-readable). They live as
// a Seal-encrypted Walrus blob; only its reference (`details` + `details_seal`) is
// public here, and only the owner can decrypt it (see `seal_approve`). The routing
// metadata (name, namespace, model) stays public for listing and dispatch.
public struct Agent has key {
    id: UID,
    account_id: ID,
    owner: address,
    name: String,
    namespace: String,
    model: String,
    details: WalrusRef,
    details_seal: SealRef,
    config: VecMap<String, String>,
    kb_access: VecSet<ID>,
    status: AgentStatus,
    created_at_ms: u64,
    updated_at_ms: u64,
}

public struct AgentCreated has copy, drop {
    account_id: ID,
    agent_id: ID,
    owner: address,
    name: String,
    namespace: String,
    timestamp_ms: u64,
}

public struct AgentRenamed has copy, drop { agent_id: ID, name: String, timestamp_ms: u64 }
public struct AgentDetailsUpdated has copy, drop { agent_id: ID, timestamp_ms: u64 }
public struct NamespaceSet has copy, drop { agent_id: ID, namespace: String, timestamp_ms: u64 }
public struct AgentConfigured has copy, drop { agent_id: ID, timestamp_ms: u64 }
public struct ConfigSet has copy, drop { agent_id: ID, key: String, timestamp_ms: u64 }
public struct ConfigRemoved has copy, drop { agent_id: ID, key: String, timestamp_ms: u64 }
public struct AgentStatusChanged has copy, drop { agent_id: ID, status: u8, timestamp_ms: u64 }
public struct KbAccessGranted has copy, drop { agent_id: ID, kb_file_id: ID, timestamp_ms: u64 }
public struct KbAccessRevoked has copy, drop { agent_id: ID, kb_file_id: ID, timestamp_ms: u64 }
public struct AgentDeleted has copy, drop { account_id: ID, agent_id: ID, timestamp_ms: u64 }

public fun create_agent(
    account: &mut Account,
    name: String,
    namespace: String,
    model: String,
    details: WalrusRef,
    details_seal: SealRef,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock.timestamp_ms();
    let owner = account.owner();
    let account_id = object::id(account);

    let agent = Agent {
        id: object::new(ctx),
        account_id,
        owner,
        name,
        namespace,
        model,
        details,
        details_seal,
        config: vec_map::empty(),
        kb_access: vec_set::empty(),
        status: AgentStatus::Active,
        created_at_ms: now_ms,
        updated_at_ms: now_ms,
    };
    let agent_id = object::id(&agent);
    account::link_agent(account, agent_id, now_ms);

    event::emit(AgentCreated { account_id, agent_id, owner, name, namespace, timestamp_ms: now_ms });
    transfer::transfer(agent, owner);
}

public fun rename(agent: &mut Agent, name: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.name = name;
    agent.updated_at_ms = now_ms;
    event::emit(AgentRenamed { agent_id: object::id(agent), name, timestamp_ms: now_ms });
}

// Replace the encrypted details blob (prompt/description) with a new one.
public fun set_details(agent: &mut Agent, details: WalrusRef, details_seal: SealRef, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.details = details;
    agent.details_seal = details_seal;
    agent.updated_at_ms = now_ms;
    event::emit(AgentDetailsUpdated { agent_id: object::id(agent), timestamp_ms: now_ms });
}

public fun set_namespace(agent: &mut Agent, namespace: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.namespace = namespace;
    agent.updated_at_ms = now_ms;
    event::emit(NamespaceSet { agent_id: object::id(agent), namespace, timestamp_ms: now_ms });
}

public fun configure(
    agent: &mut Agent,
    model: String,
    details: WalrusRef,
    details_seal: SealRef,
    clock: &Clock,
) {
    let now_ms = clock.timestamp_ms();
    agent.model = model;
    agent.details = details;
    agent.details_seal = details_seal;
    agent.updated_at_ms = now_ms;
    event::emit(AgentConfigured { agent_id: object::id(agent), timestamp_ms: now_ms });
}

public fun set_config(agent: &mut Agent, key: String, value: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    util::upsert(&mut agent.config, key, value);
    agent.updated_at_ms = now_ms;
    event::emit(ConfigSet { agent_id: object::id(agent), key, timestamp_ms: now_ms });
}

public fun remove_config(agent: &mut Agent, key: String, clock: &Clock) {
    assert!(agent.config.contains(&key), EUnknownConfig);
    let now_ms = clock.timestamp_ms();
    agent.config.remove(&key);
    agent.updated_at_ms = now_ms;
    event::emit(ConfigRemoved { agent_id: object::id(agent), key, timestamp_ms: now_ms });
}

public fun activate(agent: &mut Agent, clock: &Clock) { set_status(agent, AgentStatus::Active, clock); }
public fun pause(agent: &mut Agent, clock: &Clock) { set_status(agent, AgentStatus::Paused, clock); }
public fun archive(agent: &mut Agent, clock: &Clock) { set_status(agent, AgentStatus::Archived, clock); }

public fun grant_kb_access(agent: &mut Agent, kb_file_id: ID, clock: &Clock) {
    if (util::set_insert(&mut agent.kb_access, kb_file_id)) {
        let now_ms = clock.timestamp_ms();
        agent.updated_at_ms = now_ms;
        event::emit(KbAccessGranted { agent_id: object::id(agent), kb_file_id, timestamp_ms: now_ms });
    };
}

public fun revoke_kb_access(agent: &mut Agent, kb_file_id: ID, clock: &Clock) {
    if (util::set_remove(&mut agent.kb_access, kb_file_id)) {
        let now_ms = clock.timestamp_ms();
        agent.updated_at_ms = now_ms;
        event::emit(KbAccessRevoked { agent_id: object::id(agent), kb_file_id, timestamp_ms: now_ms });
    };
}

public fun delete_agent(account: &mut Account, agent: Agent, clock: &Clock) {
    assert!(agent.account_id == object::id(account), EWrongAccount);
    let now_ms = clock.timestamp_ms();
    let account_id = agent.account_id;
    let agent_id = object::id(&agent);

    let Agent { id, .. } = agent;
    id.delete();

    account::unlink_agent(account, agent_id, now_ms);
    event::emit(AgentDeleted { account_id, agent_id, timestamp_ms: now_ms });
}

// Owner-only Seal policy: only the agent's owner can decrypt its private details
// blob. Identities are prefixed with the agent id. No delegates  -  private to the user.
entry fun seal_approve(id: vector<u8>, agent: &Agent, ctx: &TxContext) {
    assert!(ctx.sender() == agent.owner, ENoAccess);
    let prefix = util::id_bytes(object::id(agent));
    assert!(util::bytes_start_with(&id, &prefix), EBadIdentity);
}

fun set_status(agent: &mut Agent, status: AgentStatus, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.status = status;
    agent.updated_at_ms = now_ms;
    event::emit(AgentStatusChanged { agent_id: object::id(agent), status: code_of(status), timestamp_ms: now_ms });
}

fun code_of(status: AgentStatus): u8 {
    match (status) {
        AgentStatus::Active => STATUS_ACTIVE,
        AgentStatus::Paused => STATUS_PAUSED,
        AgentStatus::Archived => STATUS_ARCHIVED,
    }
}

public fun agent_account(agent: &Agent): ID { agent.account_id }
public fun agent_owner(agent: &Agent): address { agent.owner }
public fun agent_name(agent: &Agent): String { agent.name }
public fun agent_namespace(agent: &Agent): String { agent.namespace }
public fun agent_model(agent: &Agent): String { agent.model }
public fun agent_details(agent: &Agent): WalrusRef { agent.details }
public fun agent_details_seal(agent: &Agent): SealRef { agent.details_seal }
public fun agent_created_at_ms(agent: &Agent): u64 { agent.created_at_ms }
public fun agent_updated_at_ms(agent: &Agent): u64 { agent.updated_at_ms }

public fun status_code(agent: &Agent): u8 { code_of(agent.status) }
public fun is_active(agent: &Agent): bool {
    match (agent.status) { AgentStatus::Active => true, _ => false }
}

public fun config(agent: &Agent, key: String): Option<String> { agent.config.try_get(&key) }
public fun kb_access(agent: &Agent): VecSet<ID> { agent.kb_access }
public fun has_kb_access(agent: &Agent, kb_file_id: ID): bool { agent.kb_access.contains(&kb_file_id) }

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, agent: &Agent, ctx: &TxContext) {
    seal_approve(id, agent, ctx);
}
