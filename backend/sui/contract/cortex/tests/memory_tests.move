#[test_only]
module cortex::memory_tests;

use std::string;
use sui::{clock, test_scenario as ts};
use cortex::{
    access,
    account::{Self, Account, Registry},
    memory::{Self, MemoryEntry},
    seal,
    walrus,
};

const OWNER: address = @0xA11CE;
const DELEGATE: address = @0xDDD;
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

fun register_owner(scenario: &mut ts::Scenario) {
    ts::next_tx(scenario, OWNER);
    {
        account::init_for_testing(ts::ctx(scenario));
        access::init_for_testing(ts::ctx(scenario));
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
}

fun add_one_memory(scenario: &mut ts::Scenario) {
    ts::next_tx(scenario, OWNER);
    {
        let account = ts::take_from_sender<Account>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        let wref = walrus::new_ref(1u256, 64, 10u32, walrus::default_encoding());
        let sref = seal::new_ref(b"identity", 2);
        let mut tags = vector::empty<string::String>();
        tags.push_back(string::utf8(b"note"));
        memory::add_memory(
            &account,
            wref,
            sref,
            thirty_two_bytes(),
            string::utf8(b"general"),
            tags,
            &clk,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clk);
        ts::return_to_sender(scenario, account);
    };
}

#[test]
fun add_records_owner_readable_entry() {
    let mut scenario = ts::begin(OWNER);
    register_owner(&mut scenario);
    add_one_memory(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let entry = ts::take_shared<MemoryEntry>(&scenario);
        assert!(memory::memory_owner(&entry) == OWNER, 0);
        assert!(memory::memory_can_access(&entry, OWNER), 1);
        assert!(!memory::memory_can_access(&entry, STRANGER), 2);
        assert!(memory::memory_facet(&entry) == string::utf8(b"general"), 3);
        ts::return_shared(entry);
    };

    ts::end(scenario);
}

#[test]
fun owner_grants_and_revokes_delegate() {
    let mut scenario = ts::begin(OWNER);
    register_owner(&mut scenario);
    add_one_memory(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut entry = ts::take_shared<MemoryEntry>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        assert!(!memory::memory_can_access(&entry, DELEGATE), 0);
        memory::grant_access(&mut entry, DELEGATE, &clk, ts::ctx(&mut scenario));
        assert!(memory::memory_can_access(&entry, DELEGATE), 1);
        assert!(memory::memory_delegate_count(&entry) == 1, 2);

        memory::revoke_access(&mut entry, DELEGATE, &clk, ts::ctx(&mut scenario));
        assert!(!memory::memory_can_access(&entry, DELEGATE), 3);

        clock::destroy_for_testing(clk);
        ts::return_shared(entry);
    };

    ts::end(scenario);
}

#[test]
fun owner_removes_entry() {
    let mut scenario = ts::begin(OWNER);
    register_owner(&mut scenario);
    add_one_memory(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let entry = ts::take_shared<MemoryEntry>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        memory::remove_memory(entry, &clk, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
    };

    ts::end(scenario);
}
