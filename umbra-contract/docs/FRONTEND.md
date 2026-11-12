# Frontend integration

## Network and data handling

Use this contract only on NEAR testnet. Connect with a wallet that supports
NEAR's wallet selector/standard and make all contract calls against the same
testnet account that was initialized.

The registry is deliberately not a trade-data store. The frontend/backend
should encrypt trades off-chain, publish ciphertext and each follower's
encrypted key envelope to an appropriate storage system, and pass only
public-key material and bounded references to this contract. Never send a
private key or plaintext trade to a contract method.

The contract uses `U128` and `U64` JSON wrappers for yoctoNEAR amounts and
nanosecond timestamps. These are decimal strings in JSON: parse them with
`BigInt` in JavaScript, not `Number`.

## Contract methods

| Method | Access | Behavior |
|---|---|---|
| `new({ owner_id, attestor_id, protocol_fee_bps })` | One-time initialization | Sets owner, PnL attestor, and a fee from 0 to 1,000 bps. |
| `register_trader({ handle, enc_pub_key, price_per_period, period_seconds, max_followers })` | Payable, signer is trader | Requires exactly `0.02 NEAR`; key must be base64 encoding of 32 bytes; handle is 3-32 lowercase ASCII letters, digits, or underscores. |
| `update_terms({ price_per_period, period_seconds, max_followers })` | Signer is trader | Changes terms used for new purchases and renewals. |
| `set_active({ active })` | Signer is trader | Toggles whether new subscribers are accepted. |
| `rotate_key({ new_enc_pub_key })` | Signer is trader | Replaces the public encryption key and increments `current_epoch`. |
| `subscribe({ trader_id })` | Payable, signer is follower | Attaches exactly the current price. Purchases/extends the subscription and accrues earnings. |
| `grant_access({ follower, envelope_pointer })` | Signer is trader | Publishes the pointer for the active subscriber and current key epoch. |
| `revoke_follower({ follower })` | Signer is trader | Revokes access without deleting past epoch pointers. |
| `submit_pnl_snapshot({ trader_id, return_bps, win_rate_bps, trades_count, max_drawdown_bps, window_days, data_hash })` | Signer is configured attestor | Appends a public snapshot; only the newest 90 are retained. |
| `set_paused({ paused })` | Signer is owner | Prevents/resumes trader registration and subscription purchases. |
| `withdraw_earnings()` | Signer is recipient trader | Sends the caller's pending subscription earnings. |
| `withdraw_protocol_earnings()` | Signer is owner | Sends accumulated protocol fees to the owner. |
| `get_config()` | View | Returns owner, attestor, fee, pause state, and protocol earnings. |
| `get_trader({ account_id })` | View | Looks up a trader by account. |
| `get_trader_by_handle({ handle })` | View | Looks up a trader by unique handle. |
| `get_traders({ from_index, limit })` | View | Returns a trader page; `limit` cannot exceed 100. |
| `get_subscription({ trader_id, follower_id })` | View | Returns expiry, granted epoch, and revocation status. |
| `get_envelope_pointer({ trader_id, follower_id, epoch })` | View | Reads the pointer at a particular key epoch. |
| `get_pnl_snapshots({ trader_id, limit })` | View | Returns up to 90 latest snapshots in chronological order. |
| `get_pending_earnings({ account_id })` | View | Returns unwithdrawn trader earnings. |

Use the account ID and handle returned by registry views as public identifiers.
Subscription expiry and trader registration time are nanoseconds since the
Unix epoch. The contract stores periods as seconds.

## Suggested subscriber flow

1. Read the trader's current price, key, epoch, period, and active state.
2. Ask the wallet to call `subscribe`, attaching exactly the quoted
   `price_per_period`.
3. After successful finality, make the encrypted content available to the
   follower and arrange for the trader to publish the envelope pointer with
   `grant_access`.
4. Read `get_envelope_pointer` for the subscriber and the trader's current
   epoch. Treat subscription expiry and revocation as the access control
   signal; a pointer by itself does not grant authorization.
5. On key rotation, the trader must make new envelopes and call `grant_access`
   again for subscribers whose current-epoch pointer should be updated.

The frontend must not infer that a PnL snapshot is independently verified
performance: it is an attestor-signed-on-chain assertion and a public data
reference.
