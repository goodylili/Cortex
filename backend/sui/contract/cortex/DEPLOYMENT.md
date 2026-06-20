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

The MCP executor wallet signs gated executor calls and needs native gas (mainnet
SUI) to operate. Its private key is server-only and never committed.

### Where these are wired

- Frontend (`frontend/.env.local`): `NEXT_PUBLIC_CORTEX_PACKAGE_ID`, `…_REGISTRY_ID`, `…_ACCESS_REGISTRY`, `…_EXECUTOR_CAP`, `…_MCP_ADDRESS`.
- MCP server (`backend/mcp/.env`, see `backend/mcp/.env.example`): `CORTEX_PACKAGE_ID`, `CORTEX_ACCESS_REGISTRY`, `CORTEX_EXECUTOR_CAP`, `CORTEX_DELEGATE_KEY`.
