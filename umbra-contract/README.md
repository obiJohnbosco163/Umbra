# UmbraRegistry

UmbraRegistry is a **testnet-only** NEAR smart contract for trader registration,
pricing, follower subscriptions, payments, encrypted-key envelope pointers, key
rotation, and public PnL attestations.

The contract stores public account and encryption-key data, hashes/pointers, and
accounting state only. It never accepts or stores trade records, plaintext
encryption keys, or private keys. Trade data and encrypted key envelopes must be
created, encrypted, and hosted off-chain by the application.

## Requirements

- Rust 1.99.1 (selected in `rust-toolchain.toml`) with the
  `wasm32-unknown-unknown` target
- Cargo

## Build and test

```bash
cargo test
cargo build --target wasm32-unknown-unknown --release
```

The release profile optimizes for a small Wasm artifact. Use NEAR tooling such
as `cargo-near` for a reproducible contract build and deployment workflow.

## Testnet-only deployment

Deploy only to NEAR testnet. Initialize the deployed account with the testnet
owner and attestor account IDs, and a protocol fee of at most 1,000 basis
points. Contract initialization is a one-time action:

```json
{
  "owner_id": "owner.testnet",
  "attestor_id": "attestor.testnet",
  "protocol_fee_bps": 500
}
```

`register_trader` requires an exact attached deposit of `0.02 NEAR`, retained
by the registry as its registration storage deposit. A subscriber must attach
exactly the trader's current price. The price is denominated in yoctoNEAR.
Subscription periods use seconds, while timestamps returned from the contract
are nanoseconds.

See [docs/FRONTEND.md](docs/FRONTEND.md) for the method and integration
reference.

## Important operational notes

- Traders need to call `grant_access` for each active subscriber and current
  key epoch after publishing the corresponding encrypted envelope off-chain.
- Key rotation increments the trader's epoch; old envelope pointers remain
  readable and are not deleted by revocation.
- Only the configured attestor can submit snapshots. PnL fields and their
  referenced hash are public, not a proof of trading performance.
- Subscription revenue is split between pending trader earnings and protocol
  earnings. Each can be withdrawn by its recipient; failed transfers restore
  the prior accounting balance.
- This contract is not audited. Keep production funds and private data off
  mainnet until the contract and the complete off-chain cryptographic flow
  receive independent security review.
