module cortex::agents;

use std::string::String;
use sui::{clock::Clock, event, vec_map::{Self, VecMap}, vec_set::{Self, VecSet}};
use cortex::{account::{Self, Account}, util};

const EWrongAccount: u64 = 1;
const EUnknownConfig: u64 = 2;

const STATUS_ACTIVE: u8 = 0;
const STATUS_PAUSED: u8 = 1;
const STATUS_ARCHIVED: u8 = 2;

public enum AgentStatus has copy, drop, store {
    Active,
    Paused,
    Archived,
}

public struct Agent has key {
    id: UID,
    account_id: ID,
    owner: address,
    name: String,
    description: String,
    namespace: String,
    model: String,
    system_prompt: String,
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
public struct AgentDescribed has copy, drop { agent_id: ID, timestamp_ms: u64 }
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
    description: String,
    namespace: String,
    model: String,
    system_prompt: String,
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
        description,
        namespace,
        model,
        system_prompt,
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

public fun set_description(agent: &mut Agent, description: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.description = description;
    agent.updated_at_ms = now_ms;
    event::emit(AgentDescribed { agent_id: object::id(agent), timestamp_ms: now_ms });
}

public fun set_namespace(agent: &mut Agent, namespace: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.namespace = namespace;
    agent.updated_at_ms = now_ms;
    event::emit(NamespaceSet { agent_id: object::id(agent), namespace, timestamp_ms: now_ms });
}

public fun configure(agent: &mut Agent, model: String, system_prompt: String, clock: &Clock) {
    let now_ms = clock.timestamp_ms();
    agent.model = model;
    agent.system_prompt = system_prompt;
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
public fun agent_description(agent: &Agent): String { agent.description }
public fun agent_namespace(agent: &Agent): String { agent.namespace }
public fun agent_model(agent: &Agent): String { agent.model }
public fun agent_system_prompt(agent: &Agent): String { agent.system_prompt }
public fun agent_created_at_ms(agent: &Agent): u64 { agent.created_at_ms }
public fun agent_updated_at_ms(agent: &Agent): u64 { agent.updated_at_ms }

public fun status_code(agent: &Agent): u8 { code_of(agent.status) }
public fun is_active(agent: &Agent): bool {
    match (agent.status) { AgentStatus::Active => true, _ => false }
}

public fun config(agent: &Agent, key: String): Option<String> { agent.config.try_get(&key) }
public fun kb_access(agent: &Agent): VecSet<ID> { agent.kb_access }
public fun has_kb_access(agent: &Agent, kb_file_id: ID): bool { agent.kb_access.contains(&kb_file_id) }
