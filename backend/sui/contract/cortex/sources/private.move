// Owner-only Seal policy for durable user blobs (chat sessions, timeline, document
// index). Identities are prefixed with the caller's own 32-byte address, so only
// that wallet can ever produce a passing identity and unseal its own data. No
// delegates, no object scope: the address itself is the access boundary.
module cortex::private;

use cortex::util;

const EBadIdentity: u64 = 2;

entry fun seal_approve(id: vector<u8>, ctx: &TxContext) {
    let owner = ctx.sender().to_bytes();
    assert!(util::bytes_start_with(&id, &owner), EBadIdentity);
}

#[test_only]
public fun seal_approve_for_testing(id: vector<u8>, ctx: &TxContext) {
    seal_approve(id, ctx);
}
