/// Seal access policy for a Cortex namespace. The namespace owner holds an
/// `Allowlist`; delegate keys added here can decrypt the namespace's blobs.
/// `seal_approve` is the entry Seal calls to gate decryption.
module cortex::allowlist {
    use sui::vec_set::{Self, VecSet};

    public struct Allowlist has key {
        id: UID,
        owner: address,
        members: VecSet<address>,
    }

    public struct AdminCap has key, store { id: UID, list: ID }

    const ENotOwner: u64 = 0;
    const ENotAllowed: u64 = 1;

    public fun create(ctx: &mut TxContext): AdminCap {
        let list = Allowlist {
            id: object::new(ctx),
            owner: ctx.sender(),
            members: vec_set::empty(),
        };
        let cap = AdminCap { id: object::new(ctx), list: object::id(&list) };
        transfer::share_object(list);
        cap
    }

    public fun add(list: &mut Allowlist, member: address, ctx: &TxContext) {
        assert!(list.owner == ctx.sender(), ENotOwner);
        if (!list.members.contains(&member)) list.members.insert(member);
    }

    public fun remove(list: &mut Allowlist, member: address, ctx: &TxContext) {
        assert!(list.owner == ctx.sender(), ENotOwner);
        if (list.members.contains(&member)) list.members.remove(&member);
    }

    /// Seal calls this to approve a decryption request for `caller`.
    entry fun seal_approve(caller: address, list: &Allowlist) {
        assert!(list.owner == caller || list.members.contains(&caller), ENotAllowed);
    }
}
