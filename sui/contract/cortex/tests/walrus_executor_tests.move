#[test_only]
module cortex::walrus_executor_tests;

use std::string;
use sui::{clock, test_scenario as ts};
use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account, Registry},
    seal,
    walrus::{Self, KbFile},
};

const OWNER: address = @0xA11CE;
const DELEGATE: address = @0xDDD;
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

#[test]
fun engine_grants_delegate_on_kb_file() {
    let mut scenario = ts::begin(OWNER);

    ts::next_tx(&mut scenario, OWNER);
    {
        account::init_for_testing(ts::ctx(&mut scenario));
        access::init_for_testing(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut registry = ts::take_shared<Registry>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        account::register(
            &mut registry,
            object::id_from_address(ZERO_ID),
            string::utf8(b"Cortex"),
            string::utf8(b"alice"),
            string::utf8(b"bio"),
            &clk,
            ts::ctx(&mut scenario),
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut account = ts::take_from_sender<Account>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        let wref = walrus::new_ref(1u256, 64, 10u32, walrus::default_encoding());
        let sref = seal::new_ref(b"identity", 2);
        walrus::add_kb_file(
            &mut account,
            string::utf8(b"notes.pdf"),
            string::utf8(b"application/pdf"),
            wref,
            sref,
            thirty_two_bytes(),
            &clk,
            ts::ctx(&mut scenario),
        );
        clock::destroy_for_testing(clk);
        ts::return_to_sender(&scenario, account);
    };

    ts::next_tx(&mut scenario, OWNER);
    {
        let registry = ts::take_shared<AccessRegistry>(&scenario);
        let cap = ts::take_from_sender<ExecutorCap>(&scenario);
        let mut kb = ts::take_shared<KbFile>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        assert!(!walrus::kb_can_access(&kb, DELEGATE), 0);
        walrus::executor_grant_access(&registry, &cap, &mut kb, DELEGATE, &clk);
        assert!(walrus::kb_can_access(&kb, DELEGATE), 1);

        walrus::executor_revoke_access(&registry, &cap, &mut kb, DELEGATE, &clk);
        assert!(!walrus::kb_can_access(&kb, DELEGATE), 2);

        clock::destroy_for_testing(clk);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(kb);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}
