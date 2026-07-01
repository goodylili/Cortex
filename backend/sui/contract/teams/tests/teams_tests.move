#[test_only]
module teams::teams_tests {
  use cortex::{
    access::{Self, AccessRegistry, ExecutorCap},
    account::{Self, Account, Registry}
  };
  use std::string;
  use sui::{clock, test_scenario as ts};
  use teams::team::{Self, Team};

  const OWNER: address = @0xA11CE;
  const MEMBER: address = @0xF1E0D;
  const STRANGER: address = @0xBAD;
  const ZERO_ID: address = @0x0;

  const SCOPE_SUFFIX: u8 = 0x9;

  fun scoped_identity(team: &Team): vector<u8> {
    let mut id = object::id(team).to_address().to_bytes();
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

    register(scenario, OWNER, b"acme");

    ts::next_tx(scenario, OWNER);
    {
      let acct = ts::take_from_sender<Account>(scenario);
      let clk = clock::create_for_testing(ts::ctx(scenario));
      team::create_team(
        &acct,
        string::utf8(b"Acme Corp"),
        &clk,
        ts::ctx(scenario),
      );
      clock::destroy_for_testing(clk);
      ts::return_to_sender(scenario, acct);
    };
  }

  fun add(scenario: &mut ts::Scenario, member: address, role: u8) {
    ts::next_tx(scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(scenario);
      let clk = clock::create_for_testing(ts::ctx(scenario));
      team::add_member_by_address(
        &mut team,
        member,
        string::utf8(b"bob.cortex.sui"),
        role,
        &clk,
        ts::ctx(scenario),
      );
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };
  }

  #[test]
  fun create_team_makes_owner_an_admin_member() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
      let team = ts::take_shared<Team>(&scenario);
      assert!(team.is_active(), 0);
      assert!(team.team_name() == string::utf8(b"Acme Corp"), 1);
      assert!(team.owner_handle() == string::utf8(b"acme.cortex.sui"), 2);
      assert!(team.member_count() == 1, 3);
      assert!(team.is_member(OWNER), 4);
      assert!(team.is_admin(OWNER), 5);
      assert!(!team.has_feed(), 6);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  fun add_member_by_address_records_role() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, OWNER);
    {
      let team = ts::take_shared<Team>(&scenario);
      assert!(team.is_member(MEMBER), 0);
      assert!(!team.is_admin(MEMBER), 1);
      assert!(team.member_count() == 2, 2);
      assert!(
        team.member_role(MEMBER).destroy_some() == team::role_member(),
        3,
      );
      assert!(
        team.member_name(MEMBER).destroy_some() == string::utf8(b"bob.cortex.sui"),
        4,
      );
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  fun add_member_by_handle_resolves_address() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    register(&mut scenario, MEMBER, b"bob");

    ts::next_tx(&mut scenario, OWNER);
    {
      let registry = ts::take_shared<Registry>(&scenario);
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::add_member_by_handle(
        &mut team,
        &registry,
        string::utf8(b"bob"),
        team::role_admin(),
        &clk,
        ts::ctx(&mut scenario),
      );
      assert!(team.is_member(MEMBER), 0);
      assert!(team.is_admin(MEMBER), 1);
      assert!(
        team.member_name(MEMBER).destroy_some() == string::utf8(b"bob.cortex.sui"),
        2,
      );
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun remove_member_drops_them() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::remove_member(&mut team, MEMBER, &clk, ts::ctx(&mut scenario));
      assert!(!team.is_member(MEMBER), 0);
      assert!(team.member_count() == 1, 1);
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  fun set_role_promotes_member() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::set_role(
        &mut team,
        MEMBER,
        team::role_admin(),
        &clk,
        ts::ctx(&mut scenario),
      );
      assert!(team.is_admin(MEMBER), 0);
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::EOwnerRequired)]
  fun owner_cannot_be_removed() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::remove_member(&mut team, OWNER, &clk, ts::ctx(&mut scenario));
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::ENotAdmin)]
  fun non_admin_cannot_add_member() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::add_member_by_address(
        &mut team,
        STRANGER,
        string::utf8(b"evil"),
        team::role_admin(),
        &clk,
        ts::ctx(&mut scenario),
      );
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::ESelfAdd)]
  fun owner_cannot_re_add_self() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::add_member_by_address(
        &mut team,
        OWNER,
        string::utf8(b"acme"),
        team::role_member(),
        &clk,
        ts::ctx(&mut scenario),
      );
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  fun member_can_seal_approve_active_team() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, MEMBER);
    {
      let team = ts::take_shared<Team>(&scenario);
      team::seal_approve_for_testing(
        scoped_identity(&team),
        &team,
        ts::ctx(&mut scenario),
      );
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::ENoAccess)]
  fun stranger_cannot_seal_approve() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER);
    {
      let team = ts::take_shared<Team>(&scenario);
      team::seal_approve_for_testing(
        scoped_identity(&team),
        &team,
        ts::ctx(&mut scenario),
      );
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::EBadIdentity)]
  fun member_cannot_seal_approve_foreign_scope() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, MEMBER);
    {
      let team = ts::take_shared<Team>(&scenario);
      let mut foreign = OWNER.to_bytes();
      foreign.push_back(SCOPE_SUFFIX);
      team::seal_approve_for_testing(foreign, &team, ts::ctx(&mut scenario));
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::ENoAccess)]
  fun archived_team_denies_member() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::archive_team(&mut team, &clk, ts::ctx(&mut scenario));
      assert!(team.status() == team::status_archived(), 0);
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::next_tx(&mut scenario, MEMBER);
    {
      let team = ts::take_shared<Team>(&scenario);
      team::seal_approve_for_testing(
        scoped_identity(&team),
        &team,
        ts::ctx(&mut scenario),
      );
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  fun member_can_set_feed_blob() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, MEMBER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::set_feed_blob(
        &mut team,
        string::utf8(b"blob-abc"),
        &clk,
        ts::ctx(&mut scenario),
      );
      assert!(team.has_feed(), 0);
      assert!(team.feed_blob() == string::utf8(b"blob-abc"), 1);
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  #[expected_failure(abort_code = teams::team::ENotMember)]
  fun stranger_cannot_set_feed_blob() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, STRANGER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::set_feed_blob(
        &mut team,
        string::utf8(b"blob-abc"),
        &clk,
        ts::ctx(&mut scenario),
      );
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::end(scenario);
  }

  #[test]
  fun executor_can_set_memory_blob() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);

    ts::next_tx(&mut scenario, OWNER);
    {
      access::init_for_testing(ts::ctx(&mut scenario));
    };

    ts::next_tx(&mut scenario, OWNER);
    {
      let registry = ts::take_shared<AccessRegistry>(&scenario);
      let cap = access::mint_executor_cap_for_testing(ts::ctx(&mut scenario));
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::executor_set_memory(
        &registry,
        &cap,
        &mut team,
        string::utf8(b"mem-blob"),
        &clk,
      );
      assert!(team.has_memory(), 0);
      assert!(team.memory_blob() == string::utf8(b"mem-blob"), 1);
      clock::destroy_for_testing(clk);
      access::burn_executor_cap(cap);
      ts::return_shared(team);
      ts::return_shared(registry);
    };

    ts::end(scenario);
  }

  #[test]
  fun reactivate_restores_member_access() {
    let mut scenario = ts::begin(OWNER);
    setup(&mut scenario);
    add(&mut scenario, MEMBER, team::role_member());

    ts::next_tx(&mut scenario, OWNER);
    {
      let mut team = ts::take_shared<Team>(&scenario);
      let clk = clock::create_for_testing(ts::ctx(&mut scenario));
      team::archive_team(&mut team, &clk, ts::ctx(&mut scenario));
      team::reactivate_team(&mut team, &clk, ts::ctx(&mut scenario));
      assert!(team.is_active(), 0);
      clock::destroy_for_testing(clk);
      ts::return_shared(team);
    };

    ts::next_tx(&mut scenario, MEMBER);
    {
      let team = ts::take_shared<Team>(&scenario);
      team::seal_approve_for_testing(
        scoped_identity(&team),
        &team,
        ts::ctx(&mut scenario),
      );
      ts::return_shared(team);
    };

    ts::end(scenario);
  }
}
