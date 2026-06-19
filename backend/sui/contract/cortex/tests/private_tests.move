#[test_only]
module cortex::private_tests;

use sui::test_scenario as ts;
use cortex::private;

const OWNER: address = @0xA11CE;
const STRANGER: address = @0xBAD;

#[test]
fun owner_can_unseal_own_blob() {
    let mut scenario = ts::begin(OWNER);
    ts::next_tx(&mut scenario, OWNER);
    {
        let mut id = OWNER.to_bytes();
        id.push_back(0x1);
        private::seal_approve_for_testing(id, ts::ctx(&mut scenario));
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = cortex::private::EBadIdentity)]
fun stranger_cannot_unseal_others_blob() {
    let mut scenario = ts::begin(STRANGER);
    ts::next_tx(&mut scenario, STRANGER);
    {
        let id = OWNER.to_bytes();
        private::seal_approve_for_testing(id, ts::ctx(&mut scenario));
    };
    ts::end(scenario);
}
