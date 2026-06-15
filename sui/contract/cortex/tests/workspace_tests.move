#[test_only]
module cortex::workspace_tests;

use std::string;
use sui::{clock, test_scenario as ts};
use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account, Registry},
    workspace::{Self, Workspace},
};

const OWNER: address = @0xA11CE;
const DELEGATE: address = @0xDDD;
const STRANGER: address = @0xBAD;
const ZERO_ID: address = @0x0;

fun setup(scenario: &mut ts::Scenario) {
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

    ts::next_tx(scenario, OWNER);
    {
        let account = ts::take_from_sender<Account>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        workspace::create_workspace(&account, &clk, ts::ctx(scenario));
        clock::destroy_for_testing(clk);
        ts::return_to_sender(scenario, account);
    };
}

#[test]
fun owner_sets_tasks() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut ws = ts::take_shared<Workspace>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        assert!(ws.tasks_blob() == string::utf8(b""), 0);
        workspace::owner_set_tasks(&mut ws, string::utf8(b"task-blob-1"), &clk, ts::ctx(&mut scenario));
        assert!(ws.tasks_blob() == string::utf8(b"task-blob-1"), 1);

        clock::destroy_for_testing(clk);
        ts::return_shared(ws);
    };

    ts::end(scenario);
}

#[test]
fun delegate_can_access_and_seal_approve() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut ws = ts::take_shared<Workspace>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        assert!(!ws.can_access(DELEGATE), 0);
        workspace::grant_delegate(&mut ws, DELEGATE, &clk, ts::ctx(&mut scenario));
        assert!(ws.is_delegate(DELEGATE), 1);
        assert!(ws.can_access(DELEGATE), 2);

        clock::destroy_for_testing(clk);
        ts::return_shared(ws);
    };

    ts::next_tx(&mut scenario, OWNER);
    {
        let ws = ts::take_shared<Workspace>(&scenario);
        let mut id = object::id(&ws).to_address().to_bytes();
        id.push_back(0x7);
        workspace::seal_approve_for_testing(id, &ws, ts::ctx(&mut scenario));
        ts::return_shared(ws);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::workspace::ENoAccess)]
fun stranger_rejected_by_seal_approve() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER);
    {
        let ws = ts::take_shared<Workspace>(&scenario);
        let mut id = object::id(&ws).to_address().to_bytes();
        id.push_back(0x7);
        workspace::seal_approve_for_testing(id, &ws, ts::ctx(&mut scenario));
        ts::return_shared(ws);
    };

    ts::end(scenario);
}

#[test]
fun executor_sets_tasks() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let registry = ts::take_shared<AccessRegistry>(&scenario);
        let cap = ts::take_from_sender<ExecutorCap>(&scenario);
        let mut ws = ts::take_shared<Workspace>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        workspace::executor_set_tasks(&registry, &cap, &mut ws, string::utf8(b"engine-blob"), &clk);
        assert!(ws.tasks_blob() == string::utf8(b"engine-blob"), 0);

        clock::destroy_for_testing(clk);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(ws);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}
