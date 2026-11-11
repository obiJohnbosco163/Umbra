# Umbra frontend

The frontend reads trader profiles, terms, public PnL snapshots, and subscription
state from the UmbraRegistry deployed on **NEAR testnet**. Wallet connection and
payable registry calls use NEAR Wallet Selector. There is no demo-data fallback:
if the registry is not configured or has no records, the app reports that state
instead of filling the interface with example traders.

The contract stores registry and money state only. It does not store trade data,
plaintext keys, or private keys. Off-chain trade feeds and key-envelope storage
are separate systems and are not provided by this frontend.

## Configure the deployed contract

The value printed as `SHA-256 checksum bs58` after building the Wasm is the code
checksum, **not** the deployed contract account ID. Use the actual NEAR testnet
account ID to which you deployed the contract.

```bash
cp .env.example .env
```

Set this value in `.env`:

```dotenv
VITE_REGISTRY_ACCOUNT_ID=johnbosco-dev.testnet
```

The generated contract ABI is checked in at
[`public/umbra_registry_abi.json`](public/umbra_registry_abi.json). View and
change methods are checked against that ABI before the frontend calls them.
Wallet Selector and the registry RPC are configured for testnet only.

The registry is initialized. Its current testnet configuration uses
`johnbosco-dev.testnet` as owner, `johnbosco.testnet` as attestor, a 500 bps
protocol fee, and is not paused. Initialization is one-time; this frontend does
not expose an initialization action.

The wallet modal includes Intear Wallet and MyNearWallet. Both sign
transactions on NEAR testnet; switch the wallet to testnet and keep testnet
NEAR available for gas and payable calls.

## Run and validate

```bash
npm ci
npm run dev
```

The Studio page registers the connected wallet as a trader. Registration
requires an X25519 public key (base64-encoded 32 bytes) and an exact `0.02 NEAR`
storage deposit. A subscriber pays the trader's exact current price through a
wallet-confirmed `subscribe` transaction.

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Current scope

- Explore and profile pages load live trader state and up to 90 PnL snapshots
  for each listed trader.
- Following checks the connected account's live subscription state.
- Studio supports on-chain trader registration.
- This frontend does not execute copy trades, publish encrypted trade feeds,
  create key envelopes, or submit PnL attestations. Those require separate
  off-chain systems or a configured attestor.
- Testnet funds and PnL attestations are not production assurances.
