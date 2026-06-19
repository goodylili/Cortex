module cortex::util;

use sui::{vec_map::{Self, VecMap}, vec_set::{Self, VecSet}};

public(package) fun set_insert<K: copy + drop>(set: &mut VecSet<K>, key: K): bool {
    if (set.contains(&key)) {
        false
    } else {
        set.insert(key);
        true
    }
}

public(package) fun set_remove<K: copy + drop>(set: &mut VecSet<K>, key: K): bool {
    if (set.contains(&key)) {
        set.remove(&key);
        true
    } else {
        false
    }
}

public(package) fun upsert<K: copy + drop, V: drop>(map: &mut VecMap<K, V>, key: K, value: V) {
    if (map.contains(&key)) {
        *map.get_mut(&key) = value;
    } else {
        map.insert(key, value);
    }
}

public(package) fun id_bytes(id: ID): vector<u8> {
    id.to_address().to_bytes()
}

public(package) fun bytes_start_with(full: &vector<u8>, prefix: &vector<u8>): bool {
    let pl = prefix.length();
    if (full.length() < pl) return false;
    let mut matches = true;
    let mut i = 0;
    while (i < pl) {
        if (*full.borrow(i) != *prefix.borrow(i)) {
            matches = false;
            break
        };
        i = i + 1;
    };
    matches
}
