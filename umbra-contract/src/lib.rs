use base64::{Engine, engine::general_purpose::STANDARD};
use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::serde::{Deserialize, Deserializer, Serialize, Serializer};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, env, near};

/// JSON decimal-string wrapper for unsigned 128-bit amounts.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(near_abi, derive(schemars::JsonSchema))]
#[cfg_attr(near_abi, schemars(with = "String"))]
pub struct U128(pub u128);

/// JSON decimal-string wrapper for unsigned 64-bit timestamps.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(near_abi, derive(schemars::JsonSchema))]
#[cfg_attr(near_abi, schemars(with = "String"))]
pub struct U64(pub u64);

macro_rules! impl_decimal_string_wrapper {
    ($name:ident, $inner:ty) => {
        impl Serialize for $name {
            fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
            where
                S: Serializer,
            {
                serializer.serialize_str(&self.0.to_string())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
            where
                D: Deserializer<'de>,
            {
                let value = <String as Deserialize>::deserialize(deserializer)?;
                value
                    .parse::<$inner>()
                    .map(Self)
                    .map_err(near_sdk::serde::de::Error::custom)
            }
        }
    };
}

impl_decimal_string_wrapper!(U128, u128);
impl_decimal_string_wrapper!(U64, u64);

const STORAGE_DEPOSIT: u128 = 20_000_000_000_000_000_000_000;
const NANOS_PER_SECOND: u64 = 1_000_000_000;
const BPS_DENOMINATOR: u128 = 10_000;
const MAX_PNL_SNAPSHOTS: usize = 90;
const MAX_TRADER_PAGE: u32 = 100;
const WITHDRAW_CALLBACK_GAS: Gas = Gas::from_tgas(5);

#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Traders,
    HandleIndex,
    Subscriptions,
    Envelopes,
    PnlSnapshots,
    ActiveFollowers,
    PendingEarnings,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
#[cfg_attr(near_abi, derive(borsh::BorshSchema))]
struct Config {
    owner_id: AccountId,
    attestor_id: AccountId,
    protocol_fee_bps: u16,
    paused: bool,
    protocol_earnings: u128,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
#[cfg_attr(near_abi, derive(borsh::BorshSchema))]
struct Trader {
    handle: String,
    enc_pub_key: String,
    price_per_period: u128,
    period_seconds: u32,
    max_followers: u32,
    active_followers: u32,
    current_epoch: u32,
    active: bool,
    registered_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[cfg_attr(near_abi, derive(borsh::BorshSchema))]
struct SubscriptionKey {
    trader_id: AccountId,
    follower_id: AccountId,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
#[cfg_attr(near_abi, derive(borsh::BorshSchema))]
struct Subscription {
    expires_at: u64,
    epoch_granted: u32,
    revoked: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[cfg_attr(near_abi, derive(borsh::BorshSchema))]
struct EnvelopeKey {
    trader_id: AccountId,
    follower_id: AccountId,
    epoch: u32,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
#[cfg_attr(near_abi, derive(borsh::BorshSchema))]
struct StoredPnlSnapshot {
    timestamp: u64,
    return_bps: i32,
    win_rate_bps: u16,
    trades_count: u32,
    max_drawdown_bps: u32,
    window_days: u16,
    data_hash: String,
}

/// JSON representation of public contract configuration.
#[derive(Serialize, Deserialize)]
#[cfg_attr(near_abi, derive(schemars::JsonSchema))]
#[serde(crate = "near_sdk::serde")]
pub struct ConfigView {
    /// Account allowed to administer the registry.
    pub owner_id: AccountId,
    /// Account allowed to attest PnL snapshots.
    pub attestor_id: AccountId,
    /// Protocol fee in basis points.
    pub protocol_fee_bps: u16,
    /// Whether new registrations and subscriptions are paused.
    pub paused: bool,
    /// Accumulated protocol earnings in yoctoNEAR.
    pub protocol_earnings: U128,
}

/// JSON representation of a registered trader.
#[derive(Serialize, Deserialize)]
#[cfg_attr(near_abi, derive(schemars::JsonSchema))]
#[serde(crate = "near_sdk::serde")]
pub struct TraderView {
    /// Registered trader's account.
    pub account_id: AccountId,
    /// Unique lowercase public handle.
    pub handle: String,
    /// Base64-encoded 32-byte X25519 public key.
    pub enc_pub_key: String,
    /// Subscription price in yoctoNEAR.
    pub price_per_period: U128,
    /// Subscription duration in seconds.
    pub period_seconds: u32,
    /// Maximum number of concurrently subscribed followers.
    pub max_followers: u32,
    /// Number of followers currently counted as active.
    pub active_followers: u32,
    /// Current encryption-key epoch.
    pub current_epoch: u32,
    /// Whether the trader accepts new subscriptions.
    pub active: bool,
    /// Registration timestamp in nanoseconds.
    pub registered_at: U64,
}

/// JSON representation of a follower's subscription.
#[derive(Serialize, Deserialize)]
#[cfg_attr(near_abi, derive(schemars::JsonSchema))]
#[serde(crate = "near_sdk::serde")]
pub struct SubscriptionView {
    /// Subscription expiration timestamp in nanoseconds.
    pub expires_at: U64,
    /// Most recent key epoch granted to this follower.
    pub epoch_granted: u32,
    /// Whether the trader revoked the subscription.
    pub revoked: bool,
}

/// JSON representation of an attested public PnL snapshot.
#[derive(Serialize, Deserialize)]
#[cfg_attr(near_abi, derive(schemars::JsonSchema))]
#[serde(crate = "near_sdk::serde")]
pub struct PnlSnapshotView {
    /// Attestation timestamp in nanoseconds.
    pub timestamp: U64,
    /// Return in basis points.
    pub return_bps: i32,
    /// Win rate in basis points.
    pub win_rate_bps: u16,
    /// Number of trades in the reporting window.
    pub trades_count: u32,
    /// Maximum drawdown in basis points.
    pub max_drawdown_bps: u32,
    /// Reporting-window length in days.
    pub window_days: u16,
    /// Public hash or pointer to the off-chain attestation data.
    pub data_hash: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct UmbraRegistry {
    config: Config,
    traders: IterableMap<AccountId, Trader>,
    handle_index: LookupMap<String, AccountId>,
    subscriptions: LookupMap<SubscriptionKey, Subscription>,
    envelopes: LookupMap<EnvelopeKey, String>,
    pnl_snapshots: LookupMap<AccountId, Vec<StoredPnlSnapshot>>,
    active_follower_ids: LookupMap<AccountId, Vec<AccountId>>,
    pending_earnings: LookupMap<AccountId, u128>,
}

#[allow(clippy::too_many_arguments)]
#[near]
impl UmbraRegistry {
    /// Initializes the registry with an owner, PnL attestor, and protocol fee.
    #[init]
    pub fn new(owner_id: AccountId, attestor_id: AccountId, protocol_fee_bps: u16) -> Self {
        assert!(protocol_fee_bps <= 1_000, "protocol fee exceeds 10%");
        Self {
            config: Config {
                owner_id,
                attestor_id,
                protocol_fee_bps,
                paused: false,
                protocol_earnings: 0,
            },
            traders: IterableMap::new(StorageKey::Traders),
            handle_index: LookupMap::new(StorageKey::HandleIndex),
            subscriptions: LookupMap::new(StorageKey::Subscriptions),
            envelopes: LookupMap::new(StorageKey::Envelopes),
            pnl_snapshots: LookupMap::new(StorageKey::PnlSnapshots),
            active_follower_ids: LookupMap::new(StorageKey::ActiveFollowers),
            pending_earnings: LookupMap::new(StorageKey::PendingEarnings),
        }
    }

    /// Registers the caller as a trader for an exact 0.02 NEAR storage deposit.
    #[payable]
    pub fn register_trader(
        &mut self,
        handle: String,
        enc_pub_key: String,
        price_per_period: U128,
        period_seconds: u32,
        max_followers: u32,
    ) {
        self.assert_not_paused();
        assert_eq!(
            env::attached_deposit().as_yoctonear(),
            STORAGE_DEPOSIT,
            "registration requires exactly 0.02 NEAR"
        );
        Self::validate_handle(&handle);
        Self::validate_public_key(&enc_pub_key);
        assert!(price_per_period.0 > 0, "price must be greater than zero");
        assert!(period_seconds > 0, "period must be greater than zero");
        assert!(max_followers > 0, "max_followers must be greater than zero");

        let account_id = env::predecessor_account_id();
        assert!(
            self.traders.get(&account_id).is_none(),
            "caller is already registered"
        );
        assert!(
            self.handle_index.get(&handle).is_none(),
            "handle is already taken"
        );

        let trader = Trader {
            handle: handle.clone(),
            enc_pub_key,
            price_per_period: price_per_period.0,
            period_seconds,
            max_followers,
            active_followers: 0,
            current_epoch: 1,
            active: true,
            registered_at: env::block_timestamp(),
        };
        self.traders.insert(account_id.clone(), trader);
        self.handle_index.insert(handle, account_id);
    }

    /// Updates the caller's terms for future subscription purchases.
    pub fn update_terms(
        &mut self,
        price_per_period: U128,
        period_seconds: u32,
        max_followers: u32,
    ) {
        assert!(price_per_period.0 > 0, "price must be greater than zero");
        assert!(period_seconds > 0, "period must be greater than zero");
        assert!(max_followers > 0, "max_followers must be greater than zero");

        let trader_id = env::predecessor_account_id();
        let active_followers = self.refresh_active_followers(&trader_id, env::block_timestamp());
        assert!(
            max_followers as usize >= active_followers.len(),
            "max_followers cannot be lower than active followers"
        );
        let trader = self
            .traders
            .get_mut(&trader_id)
            .unwrap_or_else(|| env::panic_str("trader is not registered"));
        trader.price_per_period = price_per_period.0;
        trader.period_seconds = period_seconds;
        trader.max_followers = max_followers;
    }

    /// Enables or disables the caller's acceptance of new subscriptions.
    pub fn set_active(&mut self, active: bool) {
        let trader_id = env::predecessor_account_id();
        let trader = self
            .traders
            .get_mut(&trader_id)
            .unwrap_or_else(|| env::panic_str("trader is not registered"));
        trader.active = active;
    }

    /// Rotates the caller's encryption key and advances to the next key epoch.
    pub fn rotate_key(&mut self, new_enc_pub_key: String) {
        Self::validate_public_key(&new_enc_pub_key);
        let trader_id = env::predecessor_account_id();
        let trader = self
            .traders
            .get_mut(&trader_id)
            .unwrap_or_else(|| env::panic_str("trader is not registered"));
        trader.current_epoch = trader
            .current_epoch
            .checked_add(1)
            .unwrap_or_else(|| env::panic_str("key epoch overflow"));
        trader.enc_pub_key = new_enc_pub_key;
    }

    /// Purchases or extends a subscription by paying its exact current price.
    #[payable]
    pub fn subscribe(&mut self, trader_id: AccountId) {
        self.assert_not_paused();
        let follower_id = env::predecessor_account_id();
        assert_ne!(
            trader_id, follower_id,
            "traders cannot subscribe to themselves"
        );

        let now = env::block_timestamp();
        let tracked_followers = self.refresh_active_followers(&trader_id, now);
        let trader = self
            .traders
            .get(&trader_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("trader is not registered"));
        assert!(trader.active, "trader is not accepting subscriptions");

        let deposit = env::attached_deposit().as_yoctonear();
        assert_eq!(
            deposit, trader.price_per_period,
            "incorrect subscription payment"
        );

        let subscription_key = SubscriptionKey {
            trader_id: trader_id.clone(),
            follower_id: follower_id.clone(),
        };
        let previous = self.subscriptions.get(&subscription_key).cloned();
        let was_active = previous
            .as_ref()
            .is_some_and(|subscription| !subscription.revoked && subscription.expires_at > now);
        let mut active_followers = tracked_followers;
        if was_active && !active_followers.contains(&follower_id) {
            active_followers.push(follower_id.clone());
        }
        if !was_active {
            assert!(
                active_followers.len() < trader.max_followers as usize,
                "trader has reached max_followers"
            );
            active_followers.push(follower_id.clone());
        }

        let period_nanos = u64::from(trader.period_seconds)
            .checked_mul(NANOS_PER_SECOND)
            .unwrap_or_else(|| env::panic_str("subscription period overflow"));
        let base_time = if was_active {
            previous
                .as_ref()
                .map(|subscription| subscription.expires_at)
                .unwrap_or(now)
        } else {
            now
        };
        let expires_at = base_time
            .checked_add(period_nanos)
            .unwrap_or_else(|| env::panic_str("subscription expiration overflow"));

        let fee = deposit
            .checked_mul(u128::from(self.config.protocol_fee_bps))
            .unwrap_or_else(|| env::panic_str("protocol fee calculation overflow"))
            / BPS_DENOMINATOR;
        let trader_earnings = deposit - fee;
        let next_protocol_earnings = self
            .config
            .protocol_earnings
            .checked_add(fee)
            .unwrap_or_else(|| env::panic_str("protocol earnings overflow"));
        let next_pending_earnings = self
            .pending_earnings
            .get(&trader_id)
            .copied()
            .unwrap_or(0)
            .checked_add(trader_earnings)
            .unwrap_or_else(|| env::panic_str("trader earnings overflow"));

        self.config.protocol_earnings = next_protocol_earnings;
        self.pending_earnings
            .insert(trader_id.clone(), next_pending_earnings);
        self.subscriptions.insert(
            subscription_key,
            Subscription {
                expires_at,
                epoch_granted: trader.current_epoch,
                revoked: false,
            },
        );
        let active_count = u32::try_from(active_followers.len())
            .unwrap_or_else(|_| env::panic_str("active follower count overflow"));
        self.active_follower_ids
            .insert(trader_id.clone(), active_followers);
        self.traders
            .get_mut(&trader_id)
            .unwrap_or_else(|| env::panic_str("trader is not registered"))
            .active_followers = active_count;
    }

    /// Stores the caller's encrypted key-envelope pointer for an active subscriber.
    pub fn grant_access(&mut self, follower: AccountId, envelope_pointer: String) {
        Self::validate_pointer(&envelope_pointer, "envelope pointer");
        let trader_id = env::predecessor_account_id();
        let key = SubscriptionKey {
            trader_id: trader_id.clone(),
            follower_id: follower.clone(),
        };
        let now = env::block_timestamp();
        let subscription = self
            .subscriptions
            .get_mut(&key)
            .unwrap_or_else(|| env::panic_str("subscription does not exist"));
        assert!(
            subscription.expires_at > now && !subscription.revoked,
            "subscription is not active"
        );
        let epoch = self
            .traders
            .get(&trader_id)
            .unwrap_or_else(|| env::panic_str("trader is not registered"))
            .current_epoch;
        subscription.epoch_granted = epoch;
        self.envelopes.insert(
            EnvelopeKey {
                trader_id,
                follower_id: follower,
                epoch,
            },
            envelope_pointer,
        );
    }

    /// Revokes a follower without deleting previously published epoch pointers.
    pub fn revoke_follower(&mut self, follower: AccountId) {
        let trader_id = env::predecessor_account_id();
        let key = SubscriptionKey {
            trader_id: trader_id.clone(),
            follower_id: follower,
        };
        let subscription = self
            .subscriptions
            .get_mut(&key)
            .unwrap_or_else(|| env::panic_str("subscription does not exist"));
        subscription.revoked = true;
        self.refresh_active_followers(&trader_id, env::block_timestamp());
    }

    /// Submits a public PnL snapshot using the configured attestor account.
    #[allow(clippy::too_many_arguments)]
    pub fn submit_pnl_snapshot(
        &mut self,
        trader_id: AccountId,
        return_bps: i32,
        win_rate_bps: u16,
        trades_count: u32,
        max_drawdown_bps: u32,
        window_days: u16,
        data_hash: String,
    ) {
        assert_eq!(
            env::predecessor_account_id(),
            self.config.attestor_id,
            "caller is not the configured attestor"
        );
        assert!(
            self.traders.get(&trader_id).is_some(),
            "trader is not registered"
        );
        assert!(win_rate_bps <= 10_000, "win rate cannot exceed 100%");
        assert!(
            max_drawdown_bps <= 10_000,
            "max drawdown cannot exceed 100%"
        );
        assert!(window_days > 0, "window_days must be greater than zero");
        Self::validate_pointer(&data_hash, "data_hash");

        let mut snapshots = self
            .pnl_snapshots
            .get(&trader_id)
            .cloned()
            .unwrap_or_default();
        if snapshots.len() == MAX_PNL_SNAPSHOTS {
            snapshots.remove(0);
        }
        snapshots.push(StoredPnlSnapshot {
            timestamp: env::block_timestamp(),
            return_bps,
            win_rate_bps,
            trades_count,
            max_drawdown_bps,
            window_days,
            data_hash,
        });
        self.pnl_snapshots.insert(trader_id, snapshots);
    }

    /// Pauses or resumes new trader registrations and subscription purchases.
    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.config.paused = paused;
    }

    /// Withdraws the caller's accumulated subscription earnings.
    pub fn withdraw_earnings(&mut self) -> Promise {
        let account_id = env::predecessor_account_id();
        let amount = self
            .pending_earnings
            .remove(&account_id)
            .unwrap_or_else(|| env::panic_str("no earnings to withdraw"));
        assert!(amount > 0, "no earnings to withdraw");
        self.schedule_withdrawal(account_id, amount, false)
    }

    /// Withdraws accumulated protocol earnings to the registry owner.
    pub fn withdraw_protocol_earnings(&mut self) -> Promise {
        self.assert_owner();
        let amount = self.config.protocol_earnings;
        assert!(amount > 0, "no protocol earnings to withdraw");
        self.config.protocol_earnings = 0;
        self.schedule_withdrawal(self.config.owner_id.clone(), amount, true)
    }

    /// Restores withdrawn accounting if the asynchronous NEAR transfer fails.
    #[private]
    pub fn resolve_withdrawal(
        &mut self,
        account_id: AccountId,
        amount: U128,
        protocol_withdrawal: bool,
    ) -> bool {
        if env::promise_result_checked(0, 0).is_err() {
            if protocol_withdrawal {
                self.config.protocol_earnings = self
                    .config
                    .protocol_earnings
                    .checked_add(amount.0)
                    .unwrap_or_else(|| env::panic_str("protocol earnings overflow"));
            } else {
                let restored = self
                    .pending_earnings
                    .get(&account_id)
                    .copied()
                    .unwrap_or(0)
                    .checked_add(amount.0)
                    .unwrap_or_else(|| env::panic_str("trader earnings overflow"));
                self.pending_earnings.insert(account_id, restored);
            }
            false
        } else {
            true
        }
    }

    /// Returns public configuration and accumulated protocol earnings.
    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            owner_id: self.config.owner_id.clone(),
            attestor_id: self.config.attestor_id.clone(),
            protocol_fee_bps: self.config.protocol_fee_bps,
            paused: self.config.paused,
            protocol_earnings: U128(self.config.protocol_earnings),
        }
    }

    /// Returns the trader registered to an account, if any.
    pub fn get_trader(&self, account_id: AccountId) -> Option<TraderView> {
        self.traders
            .get(&account_id)
            .map(|trader| self.to_trader_view(&account_id, trader))
    }

    /// Returns the trader registered to a public handle, if any.
    pub fn get_trader_by_handle(&self, handle: String) -> Option<TraderView> {
        let account_id = self.handle_index.get(&handle)?;
        let trader = self.traders.get(account_id)?;
        Some(self.to_trader_view(account_id, trader))
    }

    /// Returns a page of traders in storage iteration order.
    pub fn get_traders(&self, from_index: u32, limit: u32) -> Vec<TraderView> {
        assert!(limit <= MAX_TRADER_PAGE, "limit cannot exceed 100");
        self.traders
            .iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|(account_id, trader)| self.to_trader_view(account_id, trader))
            .collect()
    }

    /// Returns one subscription record, if the pair has subscribed before.
    pub fn get_subscription(
        &self,
        trader_id: AccountId,
        follower_id: AccountId,
    ) -> Option<SubscriptionView> {
        self.subscriptions
            .get(&SubscriptionKey {
                trader_id,
                follower_id,
            })
            .map(|subscription| SubscriptionView {
                expires_at: U64(subscription.expires_at),
                epoch_granted: subscription.epoch_granted,
                revoked: subscription.revoked,
            })
    }

    /// Returns a public envelope pointer for a specific key epoch, if present.
    pub fn get_envelope_pointer(
        &self,
        trader_id: AccountId,
        follower_id: AccountId,
        epoch: u32,
    ) -> Option<String> {
        self.envelopes
            .get(&EnvelopeKey {
                trader_id,
                follower_id,
                epoch,
            })
            .cloned()
    }

    /// Returns up to 90 of a trader's most recent PnL snapshots in chronological order.
    pub fn get_pnl_snapshots(&self, trader_id: AccountId, limit: u32) -> Vec<PnlSnapshotView> {
        assert!(
            limit as usize <= MAX_PNL_SNAPSHOTS,
            "limit cannot exceed 90"
        );
        let Some(snapshots) = self.pnl_snapshots.get(&trader_id) else {
            return Vec::new();
        };
        let start = snapshots.len().saturating_sub(limit as usize);
        snapshots[start..]
            .iter()
            .map(|snapshot| PnlSnapshotView {
                timestamp: U64(snapshot.timestamp),
                return_bps: snapshot.return_bps,
                win_rate_bps: snapshot.win_rate_bps,
                trades_count: snapshot.trades_count,
                max_drawdown_bps: snapshot.max_drawdown_bps,
                window_days: snapshot.window_days,
                data_hash: snapshot.data_hash.clone(),
            })
            .collect()
    }

    /// Returns an account's unwithdrawn trader earnings in yoctoNEAR.
    pub fn get_pending_earnings(&self, account_id: AccountId) -> U128 {
        U128(self.pending_earnings.get(&account_id).copied().unwrap_or(0))
    }
}

impl UmbraRegistry {
    fn validate_handle(handle: &str) {
        assert!(
            (3..=32).contains(&handle.len()),
            "handle must contain 3 to 32 ASCII characters"
        );
        assert!(
            handle
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_'),
            "handle may contain only lowercase letters, digits, and underscores"
        );
    }

    fn validate_public_key(key: &str) {
        assert!(key.len() <= 64, "public key exceeds 64 characters");
        let decoded = STANDARD
            .decode(key)
            .unwrap_or_else(|_| env::panic_str("public key must be valid base64"));
        assert_eq!(
            decoded.len(),
            32,
            "X25519 public key must decode to 32 bytes"
        );
    }

    fn validate_pointer(pointer: &str, name: &str) {
        assert!(!pointer.is_empty(), "{name} cannot be empty");
        assert!(
            pointer.chars().count() <= 128,
            "{name} cannot exceed 128 characters"
        );
    }

    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.config.owner_id,
            "caller is not the registry owner"
        );
    }

    fn assert_not_paused(&self) {
        assert!(!self.config.paused, "registry is paused");
    }

    fn refresh_active_followers(&mut self, trader_id: &AccountId, now: u64) -> Vec<AccountId> {
        let tracked = self
            .active_follower_ids
            .get(trader_id)
            .cloned()
            .unwrap_or_default();
        let mut active = Vec::with_capacity(tracked.len());
        for follower_id in tracked {
            let key = SubscriptionKey {
                trader_id: trader_id.clone(),
                follower_id: follower_id.clone(),
            };
            if self
                .subscriptions
                .get(&key)
                .is_some_and(|subscription| !subscription.revoked && subscription.expires_at > now)
            {
                active.push(follower_id);
            }
        }
        if let Some(trader) = self.traders.get_mut(trader_id) {
            trader.active_followers = u32::try_from(active.len())
                .unwrap_or_else(|_| env::panic_str("active follower count overflow"));
        }
        self.active_follower_ids
            .insert(trader_id.clone(), active.clone());
        active
    }

    fn schedule_withdrawal(
        &self,
        account_id: AccountId,
        amount: u128,
        protocol_withdrawal: bool,
    ) -> Promise {
        let args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
            "account_id": account_id,
            "amount": U128(amount),
            "protocol_withdrawal": protocol_withdrawal,
        }))
        .unwrap_or_else(|_| env::panic_str("failed to serialize withdrawal callback arguments"));
        Promise::new(account_id)
            .transfer(NearToken::from_yoctonear(amount))
            .then(Promise::new(env::current_account_id()).function_call(
                "resolve_withdrawal".to_string(),
                args,
                NearToken::from_yoctonear(0),
                WITHDRAW_CALLBACK_GAS,
            ))
    }

    fn to_trader_view(&self, account_id: &AccountId, trader: &Trader) -> TraderView {
        let now = env::block_timestamp();
        let active_followers = self
            .active_follower_ids
            .get(account_id)
            .map(|follower_ids| {
                follower_ids
                    .iter()
                    .filter(|follower_id| {
                        self.subscriptions
                            .get(&SubscriptionKey {
                                trader_id: account_id.clone(),
                                follower_id: (*follower_id).clone(),
                            })
                            .is_some_and(|subscription| {
                                !subscription.revoked && subscription.expires_at > now
                            })
                    })
                    .count()
            })
            .unwrap_or(0);
        TraderView {
            account_id: account_id.clone(),
            handle: trader.handle.clone(),
            enc_pub_key: trader.enc_pub_key.clone(),
            price_per_period: U128(trader.price_per_period),
            period_seconds: trader.period_seconds,
            max_followers: trader.max_followers,
            active_followers: u32::try_from(active_followers)
                .unwrap_or_else(|_| env::panic_str("active follower count overflow")),
            current_epoch: trader.current_epoch,
            active: trader.active,
            registered_at: U64(trader.registered_at),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::PromiseResult;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::testing_env;

    fn set_context(predecessor: AccountId, deposit: u128, timestamp: u64) {
        let context = VMContextBuilder::new()
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(timestamp)
            .build();
        testing_env!(context);
    }

    fn new_registry() -> UmbraRegistry {
        set_context(accounts(0), 0, 1_000);
        UmbraRegistry::new(accounts(0), accounts(1), 500)
    }

    fn register(registry: &mut UmbraRegistry, trader: AccountId, handle: &str) {
        set_context(trader, STORAGE_DEPOSIT, 1_000);
        registry.register_trader(
            handle.to_string(),
            "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_string(),
            U128(1_000),
            60,
            2,
        );
    }

    #[test]
    fn registration_and_handle_index_work() {
        let mut registry = new_registry();
        register(&mut registry, accounts(2), "trader_2");

        let view = registry.get_trader(accounts(2)).unwrap();
        assert_eq!(view.handle, "trader_2");
        assert_eq!(view.current_epoch, 1);
        assert_eq!(view.registered_at, U64(1_000));
        assert_eq!(
            registry
                .get_trader_by_handle("trader_2".to_string())
                .unwrap()
                .account_id,
            accounts(2)
        );
    }

    #[test]
    fn subscriptions_pay_fee_and_grant_epoch_envelopes() {
        let mut registry = new_registry();
        register(&mut registry, accounts(2), "market_maker");

        set_context(accounts(3), 1_000, 1_000);
        registry.subscribe(accounts(2));
        assert_eq!(registry.get_pending_earnings(accounts(2)), U128(950));
        assert_eq!(registry.get_config().protocol_earnings, U128(50));

        set_context(accounts(2), 0, 1_001);
        registry.grant_access(accounts(3), "cid:v1".to_string());
        assert_eq!(
            registry.get_envelope_pointer(accounts(2), accounts(3), 1),
            Some("cid:v1".to_string())
        );

        set_context(accounts(2), 0, 1_002);
        registry.rotate_key("AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=".to_string());
        set_context(accounts(2), 0, 1_003);
        registry.grant_access(accounts(3), "cid:v2".to_string());
        assert_eq!(
            registry.get_envelope_pointer(accounts(2), accounts(3), 1),
            Some("cid:v1".to_string())
        );
        assert_eq!(
            registry.get_envelope_pointer(accounts(2), accounts(3), 2),
            Some("cid:v2".to_string())
        );
        assert_eq!(registry.get_trader(accounts(2)).unwrap().current_epoch, 2);
    }

    #[test]
    fn renewals_extend_and_revocation_preserves_old_envelopes() {
        let mut registry = new_registry();
        register(&mut registry, accounts(2), "renewals");
        let one_period = 60 * NANOS_PER_SECOND;

        set_context(accounts(3), 1_000, 10_000);
        registry.subscribe(accounts(2));
        let first_expiry = registry
            .get_subscription(accounts(2), accounts(3))
            .unwrap()
            .expires_at
            .0;
        set_context(accounts(3), 1_000, 20_000);
        registry.subscribe(accounts(2));
        assert_eq!(
            registry
                .get_subscription(accounts(2), accounts(3))
                .unwrap()
                .expires_at
                .0,
            first_expiry + one_period
        );

        set_context(accounts(2), 0, 20_001);
        registry.grant_access(accounts(3), "sha256:envelope".to_string());
        registry.revoke_follower(accounts(3));
        assert!(
            registry
                .get_subscription(accounts(2), accounts(3))
                .unwrap()
                .revoked
        );
        assert_eq!(
            registry.get_envelope_pointer(accounts(2), accounts(3), 1),
            Some("sha256:envelope".to_string())
        );
        assert_eq!(
            registry.get_trader(accounts(2)).unwrap().active_followers,
            0
        );
    }

    #[test]
    fn pnl_history_is_attestor_gated_and_limited_to_90() {
        let mut registry = new_registry();
        register(&mut registry, accounts(2), "pnltrader");
        for day in 1..=91 {
            set_context(accounts(1), 0, day * NANOS_PER_SECOND);
            registry.submit_pnl_snapshot(
                accounts(2),
                day as i32,
                5_000,
                day as u32,
                1_000,
                30,
                format!("hash-{day}"),
            );
        }

        let snapshots = registry.get_pnl_snapshots(accounts(2), 90);
        assert_eq!(snapshots.len(), 90);
        assert_eq!(snapshots.first().unwrap().data_hash, "hash-2");
        assert_eq!(snapshots.last().unwrap().data_hash, "hash-91");
    }

    #[test]
    fn integer_json_wrappers_serialize_as_decimal_strings() {
        assert_eq!(
            near_sdk::serde_json::to_string(&U128(u128::MAX)).unwrap(),
            format!("\"{}\"", u128::MAX)
        );
        assert_eq!(
            near_sdk::serde_json::to_string(&U64(u64::MAX)).unwrap(),
            format!("\"{}\"", u64::MAX)
        );
        assert_eq!(
            near_sdk::serde_json::from_str::<U128>(&format!("\"{}\"", u128::MAX)).unwrap(),
            U128(u128::MAX)
        );
    }

    #[test]
    fn expired_subscriptions_are_not_counted_in_trader_views() {
        let mut registry = new_registry();
        register(&mut registry, accounts(2), "expiring");
        set_context(accounts(3), 1_000, 10_000);
        registry.subscribe(accounts(2));

        set_context(accounts(4), 0, 60 * NANOS_PER_SECOND + 10_001);
        assert_eq!(
            registry.get_trader(accounts(2)).unwrap().active_followers,
            0
        );
    }

    #[test]
    fn failed_trader_withdrawals_restore_earnings() {
        let mut registry = new_registry();
        registry.pending_earnings.insert(accounts(2), 950);
        set_context(accounts(2), 0, 1_000);
        let _ = registry.withdraw_earnings();
        assert_eq!(registry.get_pending_earnings(accounts(2)), U128(0));

        let context = VMContextBuilder::new()
            .predecessor_account_id(accounts(2))
            .build();
        testing_env!(
            context,
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            std::collections::HashMap::default(),
            vec![PromiseResult::Failed],
        );

        assert!(!registry.resolve_withdrawal(accounts(2), U128(950), false));
        assert_eq!(registry.get_pending_earnings(accounts(2)), U128(950));
    }
}
