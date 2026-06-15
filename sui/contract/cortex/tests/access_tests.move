#[test_only]
module cortex::access_tests;

use sui::{clock, test_scenario as ts};
use cortex::access::{Self, AdminCap, ExecutorCap, AccessRegistry};

const ADMIN: address = @0xAD11;
const ENGINE: address = @0xE19;

#[test]
fun mint_and_revoke_executor() {
    let mut scenario = ts::begin(ADMIN);
    {
        access::init_for_testing(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, ADMIN);
    {
        let admin = ts::take_from_sender<AdminCap>(&scenario);
        let mut registry = ts::take_shared<AccessRegistry>(&scenario);
        access::new_executor_cap(&admin, &registry, ENGINE, ts::ctx(&mut scenario));
        ts::return_to_sender(&scenario, admin);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, ENGINE);
    {
        let cap = ts::take_from_sender<ExecutorCap>(&scenario);
        let registry = ts::take_shared<AccessRegistry>(&scenario);
        access::assert_executor(&registry, &cap);
        ts::return_to_sender(&scenario, cap);
        ts::return_shared(registry);
    };

    ts::next_tx(&mut scenario, ADMIN);
    {
        let admin = ts::take_from_sender<AdminCap>(&scenario);
        let mut registry = ts::take_shared<AccessRegistry>(&scenario);
        let cap = ts::take_from_address<ExecutorCap>(&scenario, ENGINE);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        access::revoke_executor_cap(
            &admin,
            &mut registry,
            object::id(&cap),
            &clk,
            ts::ctx(&mut scenario),
        );
        assert!(access::is_executor_revoked(&registry, object::id(&cap)), 0);
        clock::destroy_for_testing(clk);
        ts::return_to_address(ENGINE, cap);
        ts::return_to_sender(&scenario, admin);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::access::EExecutorRevoked)]
fun revoked_executor_is_rejected() {
    let mut scenario = ts::begin(ADMIN);
    {
        access::init_for_testing(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, ADMIN);
    {
        let admin = ts::take_from_sender<AdminCap>(&scenario);
        let mut registry = ts::take_shared<AccessRegistry>(&scenario);
        let cap = access::mint_executor_cap_for_testing(ts::ctx(&mut scenario));
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        access::revoke_executor_cap(
            &admin,
            &mut registry,
            object::id(&cap),
            &clk,
            ts::ctx(&mut scenario),
        );
        access::assert_executor(&registry, &cap);
        clock::destroy_for_testing(clk);
        access::burn_executor_cap(cap);
        ts::return_to_sender(&scenario, admin);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::access::EAdminRevoked)]
fun revoked_admin_cannot_act() {
    let mut scenario = ts::begin(ADMIN);
    {
        access::init_for_testing(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, ADMIN);
    {
        let admin = ts::take_from_sender<AdminCap>(&scenario);
        let mut registry = ts::take_shared<AccessRegistry>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        access::revoke_admin_cap(
            &admin,
            &mut registry,
            object::id(&admin),
            &clk,
            ts::ctx(&mut scenario),
        );
        // the admin just revoked itself; the next admin-gated call must abort
        access::new_executor_cap(&admin, &registry, ENGINE, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
        ts::return_to_sender(&scenario, admin);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}
