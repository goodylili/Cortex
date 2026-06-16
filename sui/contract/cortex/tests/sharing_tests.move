#[test_only]
module cortex::sharing_tests;

use std::string;
use sui::{clock, test_scenario as ts};
use cortex::{
    account::{Self, Account, Registry},
    seal,
    sharing::{Self, MemoryShare},
    walrus,
};

const OWNER: address = @0xA11CE;
const FRIEND: address = @0xF1E0D;
const STRANGER: address = @0xBAD;
const ZERO_ID: address = @0x0;

const BLOB_ID: u256 = 0xCAFE;
const BLOB_SIZE: u64 = 1024;
const END_EPOCH: u32 = 200;
const ITEM_COUNT: u64 = 3;
const SCOPE_SUFFIX: u8 = 0x9;
const HASH_BYTES: u64 = 32;

fun content_hash(): vector<u8> {
    let mut v = vector[];
    let mut i = 0u64;
    while (i < HASH_BYTES) {
        v.push_back(0u8);
        i = i + 1;
    };
    v
}

fun scoped_identity(share: &MemoryShare): vector<u8> {
    let mut id = object::id(share).to_address().to_bytes();
    id.push_back(SCOPE_SUFFIX);
    id
}

fun register(scenario: &mut ts::Scenario, who: address, handle: vector<u8>) {
    ts::next_tx(scenario, who);
    {
        let mut registry = ts::take_shared<Registry>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        account::register(
            &mut registry,
            object::id_from_address(ZERO_ID),
            string::utf8(b"Name"),
            string::utf8(handle),
            string::utf8(b"bio"),
            &clk,
            ts::ctx(scenario),
        );
        clock::destroy_for_testing(clk);
        ts::return_shared(registry);
    };
}

fun setup(scenario: &mut ts::Scenario) {
    ts::next_tx(scenario, OWNER);
    {
        account::init_for_testing(ts::ctx(scenario));
    };

    register(scenario, OWNER, b"alice");

    ts::next_tx(scenario, OWNER);
    {
        let acct = ts::take_from_sender<Account>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        sharing::create_share(&acct, string::utf8(b"Trip notes"), &clk, ts::ctx(scenario));
        clock::destroy_for_testing(clk);
        ts::return_to_sender(scenario, acct);
    };
}

fun activate_and_share_with(scenario: &mut ts::Scenario, recipient: address) {
    ts::next_tx(scenario, OWNER);
    {
        let mut share = ts::take_shared<MemoryShare>(scenario);
        let clk = clock::create_for_testing(ts::ctx(scenario));
        let identity = scoped_identity(&share);
        let w = walrus::new_ref(BLOB_ID, BLOB_SIZE, END_EPOCH, walrus::default_encoding());
        let s = seal::new_ref(identity, seal::default_threshold());
        sharing::set_bundle(&mut share, w, s, content_hash(), ITEM_COUNT, &clk, ts::ctx(scenario));
        sharing::share_with_address(&mut share, recipient, string::utf8(b"bob.cortex.sui"), &clk, ts::ctx(scenario));
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
    };
}

#[test]
fun create_share_starts_in_draft_with_suins_handle() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let share = ts::take_shared<MemoryShare>(&scenario);
        assert!(share.status() == sharing::status_draft(), 0);
        assert!(share.owner_handle() == string::utf8(b"alice.cortex.sui"), 1);
        assert!(!share.has_bundle(), 2);
        assert!(share.recipient_count() == 0, 3);
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
fun set_bundle_activates_and_records_items() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    activate_and_share_with(&mut scenario, FRIEND);

    ts::next_tx(&mut scenario, OWNER);
    {
        let share = ts::take_shared<MemoryShare>(&scenario);
        assert!(share.is_active(), 0);
        assert!(share.has_bundle(), 1);
        assert!(share.item_count() == ITEM_COUNT, 2);
        assert!(share.is_recipient(FRIEND), 3);
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
fun recipient_can_seal_approve_active_share() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    activate_and_share_with(&mut scenario, FRIEND);

    ts::next_tx(&mut scenario, FRIEND);
    {
        let share = ts::take_shared<MemoryShare>(&scenario);
        sharing::seal_approve_for_testing(scoped_identity(&share), &share, ts::ctx(&mut scenario));
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
fun owner_can_seal_approve_draft() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let share = ts::take_shared<MemoryShare>(&scenario);
        sharing::seal_approve_for_testing(scoped_identity(&share), &share, ts::ctx(&mut scenario));
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::sharing::ENoAccess)]
fun stranger_cannot_seal_approve() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    activate_and_share_with(&mut scenario, FRIEND);

    ts::next_tx(&mut scenario, STRANGER);
    {
        let share = ts::take_shared<MemoryShare>(&scenario);
        sharing::seal_approve_for_testing(scoped_identity(&share), &share, ts::ctx(&mut scenario));
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::sharing::ENoAccess)]
fun revoked_share_denies_recipient() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    activate_and_share_with(&mut scenario, FRIEND);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut share = ts::take_shared<MemoryShare>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        sharing::revoke(&mut share, &clk, ts::ctx(&mut scenario));
        assert!(share.status() == sharing::status_revoked(), 0);
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
    };

    ts::next_tx(&mut scenario, FRIEND);
    {
        let share = ts::take_shared<MemoryShare>(&scenario);
        sharing::seal_approve_for_testing(scoped_identity(&share), &share, ts::ctx(&mut scenario));
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::sharing::EBadScope)]
fun set_bundle_rejects_foreign_scope() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut share = ts::take_shared<MemoryShare>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        let mut foreign = OWNER.to_bytes();
        foreign.push_back(SCOPE_SUFFIX);
        let w = walrus::new_ref(BLOB_ID, BLOB_SIZE, END_EPOCH, walrus::default_encoding());
        let s = seal::new_ref(foreign, seal::default_threshold());
        sharing::set_bundle(&mut share, w, s, content_hash(), ITEM_COUNT, &clk, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
fun share_with_handle_resolves_recipient() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    register(&mut scenario, FRIEND, b"bob");

    ts::next_tx(&mut scenario, OWNER);
    {
        let registry = ts::take_shared<Registry>(&scenario);
        let mut share = ts::take_shared<MemoryShare>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        sharing::share_with_handle(&mut share, &registry, string::utf8(b"bob"), &clk, ts::ctx(&mut scenario));
        assert!(share.is_recipient(FRIEND), 0);
        let name = share.recipient_name(FRIEND);
        assert!(name.destroy_some() == string::utf8(b"bob.cortex.sui"), 1);
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
        ts::return_shared(registry);
    };

    ts::end(scenario);
}

#[test]
fun unshare_removes_recipient() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    activate_and_share_with(&mut scenario, FRIEND);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut share = ts::take_shared<MemoryShare>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        assert!(share.is_recipient(FRIEND), 0);
        sharing::unshare(&mut share, FRIEND, &clk, ts::ctx(&mut scenario));
        assert!(!share.is_recipient(FRIEND), 1);
        assert!(share.recipient_count() == 0, 2);
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::sharing::ENotOwner)]
fun stranger_cannot_share() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER);
    {
        let mut share = ts::take_shared<MemoryShare>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        sharing::share_with_address(&mut share, STRANGER, string::utf8(b"evil.cortex.sui"), &clk, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
    };

    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::sharing::ESelfShare)]
fun owner_cannot_share_with_self() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
        let mut share = ts::take_shared<MemoryShare>(&scenario);
        let clk = clock::create_for_testing(ts::ctx(&mut scenario));
        sharing::share_with_address(&mut share, OWNER, string::utf8(b"alice.cortex.sui"), &clk, ts::ctx(&mut scenario));
        clock::destroy_for_testing(clk);
        ts::return_shared(share);
    };

    ts::end(scenario);
}
