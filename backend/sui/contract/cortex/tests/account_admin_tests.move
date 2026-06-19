#[test_only]
module cortex::account_admin_tests;

use std::string;
use sui::{clock, test_scenario as ts};
use cortex::account::{Self, Account, Registry};

const OWNER: address = @0xA11CE;
const MCP: address = @0xBEEF;
const ZERO_ID: address = @0x0;

fun register_owner(scenario: &mut ts::Scenario) {
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
}

#[test]
fun grant_then_revoke_admin() {
    let mut scenario = ts::begin(OWNER);
    register_owner(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut account = ts::take_from_sender<Account>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));

        assert!(!account::is_delegate(&account, MCP), 0);
        account::grant_admin(&mut account, MCP, &clk, ts::ctx(&mut scenario));
        assert!(account::is_delegate(&account, MCP), 1);
        assert!(account::can_access(&account, MCP), 2);

        account::revoke_admin(&mut account, MCP, &clk, ts::ctx(&mut scenario));
        assert!(!account::is_delegate(&account, MCP), 3);

        clock::destroy_for_testing(clk);
        ts::return_to_sender(&scenario, account);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::account::ENotOwner)]
fun non_owner_cannot_grant() {
    let mut scenario = ts::begin(OWNER);
    register_owner(&mut scenario);

    ts::next_tx(&mut scenario, MCP);
    {
        let mut account = ts::take_from_address<Account>(&scenario, OWNER);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        account::grant_admin(&mut account, MCP, &clk, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
        ts::return_to_address(OWNER, account);
    };

    ts::end(scenario);
}

#[test]
fun delegate_passes_seal_approve() {
    let mut scenario = ts::begin(OWNER);
    register_owner(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut account = ts::take_from_sender<Account>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        account::grant_admin(&mut account, MCP, &clk, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
        ts::return_to_sender(&scenario, account);
    };

    ts::next_tx(&mut scenario, MCP);
    {
        let account = ts::take_from_address<Account>(&scenario, OWNER);
        let mut id = object::id(&account).to_address().to_bytes();
        id.push_back(0x7);
        account::seal_approve_for_testing(id, &account, ts::ctx(&mut scenario));
        ts::return_to_address(OWNER, account);
    };

    ts::end(scenario);
}
