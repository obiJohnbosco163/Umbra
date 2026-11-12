import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  setupWalletSelector,
  type WalletSelector,
} from '@near-wallet-selector/core';
import { setupIntearWallet } from '@near-wallet-selector/intear-wallet';
import { setupModal, type WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMyNearWallet } from '@near-wallet-selector/my-near-wallet';
import {
  getTransactionFailure,
  RegistryClient,
  isValidTestnetAccountId,
} from '@/near/registry';
import { RegistryContext, type RegistryContextValue } from '@/near/registry-context';
import type { Trader } from '@/types/market';

const REGISTRY_ACCOUNT_ID = import.meta.env.VITE_REGISTRY_ACCOUNT_ID?.trim() ?? '';

/// Provides testnet registry reads, wallet connection, and signed contract calls.
export function RegistryProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<RegistryClient | null>(null);
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const modalRef = useRef<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [traders, setTraders] = useState<Trader[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configurationError = useMemo(() => {
    if (!REGISTRY_ACCOUNT_ID) {
      return 'Set VITE_REGISTRY_ACCOUNT_ID to the deployed NEAR testnet account ID. The Wasm checksum is not an account ID.';
    }
    if (!isValidTestnetAccountId(REGISTRY_ACCOUNT_ID)) {
      return 'VITE_REGISTRY_ACCOUNT_ID is not a valid NEAR account ID.';
    }
    return null;
  }, []);

  const refreshTraders = useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      setTraders(await client.getTraders());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to read traders from NEAR testnet.');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (configurationError) return;
    let cancelled = false;
    let accountSubscription: { unsubscribe: () => void } | undefined;

    async function initialize() {
      try {
        const registry = new RegistryClient(REGISTRY_ACCOUNT_ID);
        await registry.initialize();
        const walletSelector = await setupWalletSelector({
          network: 'testnet',
          modules: [setupIntearWallet(), setupMyNearWallet()],
        });
        const walletModal = setupModal(walletSelector, {
          contractId: REGISTRY_ACCOUNT_ID,
          theme: 'dark',
          description: 'Connect to the UmbraRegistry on NEAR testnet.',
        });
        if (cancelled) return;

        setClient(registry);
        setSelector(walletSelector);
        modalRef.current = walletModal;
        const updateAccount = (state: ReturnType<typeof walletSelector.store.getState>) => {
          setAccountId(state.accounts.find((account) => account.active)?.accountId ?? null);
        };
        updateAccount(walletSelector.store.getState());
        accountSubscription = walletSelector.store.observable.subscribe(updateAccount);
        setReady(true);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Failed to initialize NEAR testnet.');
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      accountSubscription?.unsubscribe();
    };
  }, [configurationError]);

  useEffect(() => {
    if (ready && client) void refreshTraders();
  }, [ready, client, refreshTraders]);

  const connect = useCallback(() => {
    if (!ready || !modalRef.current) {
      setError(configurationError ?? 'Wallet connection is not ready yet.');
      return;
    }
    modalRef.current.show();
  }, [configurationError, ready]);

  const disconnect = useCallback(async () => {
    if (!selector) return;
    try {
      const wallet = await selector.wallet();
      await wallet.signOut();
      setAccountId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Wallet sign-out failed.');
    }
  }, [selector]);

  const getSubscription = useCallback(
    async (traderId: string, followerId: string) => {
      if (!client) throw new Error(configurationError ?? 'Registry is not ready.');
      return client.getSubscription(traderId, followerId);
    },
    [client, configurationError],
  );

  const call = useCallback(
    async (
      method: 'register_trader' | 'subscribe',
      args: Record<string, unknown>,
      deposit: string,
    ) => {
      if (!client || !selector || !accountId) {
        throw new Error('Connect a NEAR testnet wallet before submitting this transaction.');
      }
      const wallet = await selector.wallet();
      const outcome = await client.call(method, args, wallet, accountId, deposit);
      const failure = getTransactionFailure(outcome);
      if (failure) throw new Error(`NEAR transaction failed: ${failure}`);
      await refreshTraders();
    },
    [accountId, client, refreshTraders, selector],
  );

  const value: RegistryContextValue = {
    accountId,
    configurationError,
    error,
    loading,
    ready,
    traders,
    connect,
    disconnect,
    refreshTraders,
    getSubscription,
    call,
  };

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}
