import { createContext } from 'react';
import type { Subscription, Trader } from '@/types/market';

export type RegistryContextValue = {
  accountId: string | null;
  configurationError: string | null;
  error: string | null;
  loading: boolean;
  ready: boolean;
  traders: Trader[];
  connect: () => void;
  disconnect: () => Promise<void>;
  refreshTraders: () => Promise<void>;
  getSubscription: (traderId: string, followerId: string) => Promise<Subscription | null>;
  call: (
    method: 'register_trader' | 'subscribe',
    args: Record<string, unknown>,
    deposit: string,
  ) => Promise<void>;
};

export const RegistryContext = createContext<RegistryContextValue | null>(null);
