#[test_only]
module cortex::agent_privacy_tests;

use std::string;
use sui::{clock, test_scenario as ts};
use cortex::{
    account::{Self, Account, Registry},
    agents::{Self, Agent},
    seal,
    walrus,
};

const OWNER: address = @0xA11CE;
const STRANGER: address = @0xBAD;
const ZERO_ID: address = @0x0;

fun thirty_two_bytes(): vector<u8> {
    let mut h = vector::empty<u8>();
    let mut i = 0u64;
    while (i < 32) {
        h.push_back(0u8);
        i = i + 1;
    };
    h
}

fun make_agent(scenario: &mut ts::Scenario) {
    ts::next_tx(scenario, OWNER);
    {
        account::init_for_testing(ts::ctx(scenario));
    };
    ts::next_tx(scenario, OWNER);
    {
        let mut registry = ts::take_shared<Registry>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        account::register(
            &mut registry,
            object::id_from_address(ZERO_ID),
            string::utf8(b"Cortex"),
            string::utf8(b"alice"),
            string::utf8(b"bio"),
            &clk,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(registry);
    };
    ts::next_tx(scenario, OWNER);
    {
        let mut account = ts::take_from_sender<Account>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        let wref = walrus::new_ref(7u256, 128, 10u32, walrus::default_encoding());
        let sref = seal::new_ref(b"identity", 2);
        agents::create_agent(
            &mut account,
            string::utf8(b"assistant"),
            string::utf8(b"personal"),
            string::utf8(b"claude-sonnet-4-6"),
            wref,
            sref,
            &clk,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clk);
        ts::return_to_sender(scenario, account);
    };
}

#[test]
fun owner_can_unseal_agent_details() {
    let mut scenario = ts::begin(OWNER);
    make_agent(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let agent = ts::take_from_sender<Agent>(&scenario);
        let mut id = object::id(&agent).to_address().to_bytes();
        id.push_back(0x1);
        agents::seal_approve_for_testing(id, &agent, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, agent);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::agents::ENoAccess)]
fun stranger_cannot_unseal_agent_details() {
    let mut scenario = ts::begin(OWNER);
    make_agent(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER);
    {
        let agent = ts::take_from_address<Agent>(&scenario, OWNER);
        let id = object::id(&agent).to_address().to_bytes();
        agents::seal_approve_for_testing(id, &agent, ts::ctx(&mut scenario));
        ts::return_to_address(OWNER, agent);
    };

    ts::end(scenario);
}
