# Cortex on-chain deployment

Canonical record of the published `cortex` Move package and its shared objects.
The full transaction receipt is in `published.json`; the toolchain pins in
`Published.toml`. These ids are public and safe to share.

## Mainnet

- Network: `mainnet`
- Publish digest: `8Rf4yYfxJ6NXLfCsFqQCKDoQq95eTdXTRMVtt8B6w559`
- Modules: `access`, `account`, `agents`, `cortex`, `private`, `seal`, `sharing`, `util`, `walrus`, `workspace`

| Object | Id | Notes |
| --- | --- | --- |
| Package | `0x643fbc9d6182493e533a85a49a584a1c08471e2d28e6de842eb183c8d2ed9438` | the published package |
| `account::Registry` | `0xb407205bd1443630fb865093ed4f179b142bc72aa10e94fd913ac3c1556aacfc` | shared |
| `access::AccessRegistry` | `0x0789528878ea4605e206503a3df066817e88b19ff8dbc3e6314183f9967972d1` | shared |
| `access::AdminCap` | `0x3334eff3572028956df1a3316bcb06d582d1650cfe367aaeb1ceb62bdf85b7da` | held by the admin wallet |
| `access::ExecutorCap` | `0x744a06a653c2101ff92855a89b59c8f7010af463dfe8cd3c5bac58f004b38ab3` | transferred to the MCP wallet |
| `package::UpgradeCap` | `0xea7ea1f3af23137755502f055aecd7eb024a27f57c630db9d18cc9aaf7b4d081` | held by the admin wallet |

### Wallets

| Role | Address |
| --- | --- |
| Admin / publisher (holds `AdminCap` + `UpgradeCap`) | `0x25041c0da7e900e634ce629e8da3b7adf236a2836a2f010433db3ce7b714e1f8` |
| MCP executor (holds `ExecutorCap`) | `0x552fb04f841b0db04d7ad1a4c3732ddea943434a27e8f947e031dc265639efa6` |

The MCP executor wallet signs gated executor calls and needs native gas to
operate. Its private key is server-only and never committed.

## Testnet

- Network: `testnet`
- Publish digest: `2fYED742simpoTfFsiKWjGuWZbofqqmwnvc8Z4jwq1xk`
- Modules: `access`, `account`, `agents`, `cortex`, `private`, `seal`, `sharing`, `util`, `walrus`, `workspace`

| Object | Id | Notes |
| --- | --- | --- |
| Package | `0xba40cb2abdeed0d6995dd2cfcdeccb2392cf8c0d5f1d78018d3f43e1217963e8` | the published package |
| `account::Registry` | `0x64374b163766d9afef4ecf7ecab96cbe5f3ce7a9048aca703a82afb4122bd916` | shared |
| `access::AccessRegistry` | `0xf1b18cd53be1ca2a3267319b64f203d83de589262f2b3620a199ee105ec3c0c7` | shared |
| `access::AdminCap` | `0x3fb9b09c1e8ef2fb07a39f41104193649684dace435217b21dbf7bf4e188db66` | held by the admin wallet |
| `access::ExecutorCap` | `0x8da0d85153c9a1a10a37353d594ce218913e0f2efee30c81d8edef3e6e48d1ee` | transferred to the MCP wallet |
| `package::UpgradeCap` | `0xdeff46726173b8c144855d5b9b0a4d70e3bfcb8eb2092fb9cb903c35c8d4651c` | held by the admin wallet |

The **same wallets** are reused on both networks (admin `0x25041c0d…`, MCP executor
`0x552fb04f…`). The full receipt is in `published.testnet.json`.

### Where these are wired

Both networks are configured side by side, selected at runtime by the user
(frontend) or by `CORTEX_SUI_NETWORK` (MCP):

- Frontend (`frontend/.env.local`): `NEXT_PUBLIC_CORTEX_*_MAINNET` / `*_TESTNET`
  slots; reused wallets (`NEXT_PUBLIC_CORTEX_MCP_ADDRESS`, `CORTEX_SUINS_SIGNER_KEY`)
  stay untagged. A network is offered only when its full slot set is filled.
- MCP server (`backend/mcp/.env`, see `backend/mcp/.env.example`): `CORTEX_*_MAINNET`
  / `*_TESTNET` slots, with `CORTEX_SUI_NETWORK` picking the active one; the
  `CORTEX_DELEGATE_KEY` wallet is reused across both.
