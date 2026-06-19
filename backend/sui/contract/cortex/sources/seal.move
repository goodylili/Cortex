module cortex::seal;

use std::string::String;
use cortex::util;

const EInvalidThreshold: u64 = 1;

const DEFAULT_THRESHOLD: u8 = 2;
const MIN_THRESHOLD: u8 = 1;

const CURRENT_POLICY_VERSION: u64 = 1;

public struct SealRef has store, copy, drop {
    identity: vector<u8>,
    threshold: u8,
    policy_version: u64,
}

public fun new_ref(identity: vector<u8>, threshold: u8): SealRef {
    assert!(threshold >= MIN_THRESHOLD, EInvalidThreshold);
    SealRef { identity, threshold, policy_version: CURRENT_POLICY_VERSION }
}

public fun derive_identity(scope: ID, resource: String): vector<u8> {
    let mut id = util::id_bytes(scope);
    id.append(resource.into_bytes());
    id
}

public fun identity(self: &SealRef): vector<u8> { self.identity }
public fun threshold(self: &SealRef): u8 { self.threshold }
public fun policy_version(self: &SealRef): u64 { self.policy_version }

public fun default_threshold(): u8 { DEFAULT_THRESHOLD }
public fun current_policy_version(): u64 { CURRENT_POLICY_VERSION }
