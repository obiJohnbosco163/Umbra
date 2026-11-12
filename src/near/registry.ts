import type { PnlSnapshot, Subscription, Trader } from '@/types/market';
import { actionCreators, type Wallet } from '@near-wallet-selector/core';

const RPC_URL = 'https://rpc.testnet.near.org';
const ABI_URL = `${import.meta.env.BASE_URL}umbra_registry_abi.json`;
const YOCTO_PER_NEAR = 10n ** 24n;
type ViewMethod =
  | 'get_trader'
  | 'get_trader_by_handle'
  | 'get_traders'
  | 'get_subscription'
  | 'get_pnl_snapshots';
type ChangeMethod = 'register_trader' | 'subscribe';

type RegistryAbi = {
  body: {
    functions: Array<{ name: string; kind: 'view' | 'call' }>;
  };
};

type TraderRecord = {
  account_id: string;
  handle: string;
  enc_pub_key: string;
  price_per_period: string;
  period_seconds: number;
  max_followers: number;
  active_followers: number;
  current_epoch: number;
  active: boolean;
  registered_at: string;
};

type RpcResponse<T> = {
  result?: T & { error?: string };
  error?: { code: number; message: string; data?: unknown };
};

export function isValidTestnetAccountId(accountId: string): boolean {
  return (
    accountId.length >= 2 &&
    accountId.length <= 64 &&
    /^[a-z0-9._-]+$/.test(accountId) &&
    !accountId.startsWith('.') &&
    !accountId.endsWith('.') &&
    !accountId.includes('..')
  );
}

export function formatYoctoNear(value: string): string {
  const amount = BigInt(value);
  const whole = amount / YOCTO_PER_NEAR;
  const fractional = (amount % YOCTO_PER_NEAR)
    .toString()
    .padStart(24, '0')
    .slice(0, 4)
    .replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function parseNearToYocto(value: string): string {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(value)) {
    throw new Error('Enter a valid NEAR amount with up to 24 decimal places.');
  }
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * YOCTO_PER_NEAR + BigInt(fraction.padEnd(24, '0'))).toString();
}

export function isValidX25519PublicKey(value: string): boolean {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  try {
    return atob(value).length === 32;
  } catch {
    return false;
  }
}

export function getTransactionFailure(outcome: unknown): string | null {
  if (!isRecord(outcome)) return null;

  const statuses = [
    outcome.status,
    ...(Array.isArray(outcome.receipts_outcome)
      ? outcome.receipts_outcome.map((receipt: unknown) =>
          isRecord(receipt) && isRecord(receipt.outcome) ? receipt.outcome.status : null,
        )
      : []),
  ];

  for (const status of statuses) {
    if (status === 'Failure') {
      return 'NEAR reported that the transaction failed without an error message.';
    }
    if (!isRecord(status) || !('Failure' in status)) continue;
    const failure = status.Failure;
    if (isRecord(failure) && typeof failure.error_message === 'string') {
      return failure.error_message;
    }
    return 'NEAR reported that the transaction failed without an error message.';
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function toTrader(record: TraderRecord, snapshots: PnlSnapshot[]): Trader {
  const latestForWindow = (days: number) =>
    [...snapshots].reverse().find((snapshot) => snapshot.window_days === days);
  const latest = snapshots[snapshots.length - 1];
  const handleDisplay = record.handle
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    id: record.account_id,
    accountId: record.account_id,
    handle: record.handle,
    display: handleDisplay,
    bio: `Registered on NEAR testnet as ${record.account_id}.`,
    priceYocto: record.price_per_period,
    periodSeconds: record.period_seconds,
    followers: record.active_followers,
    return7: latestForWindow(7) ? latestForWindow(7)!.return_bps / 100 : null,
    return30: latestForWindow(30) ? latestForWindow(30)!.return_bps / 100 : null,
    return90: latestForWindow(90) ? latestForWindow(90)!.return_bps / 100 : null,
    winRate: latest ? latest.win_rate_bps / 100 : null,
    drawdown: latest ? -(latest.max_drawdown_bps / 100) : null,
    verified: false,
    specialty: 'NEAR testnet',
    chart: snapshots.map((snapshot) => snapshot.return_bps / 100),
    trades: [],
    active: record.active,
    currentEpoch: record.current_epoch,
    snapshots,
  };
}

export class RegistryClient {
  private abi: RegistryAbi | null = null;

  constructor(readonly accountId: string) {
    if (!isValidTestnetAccountId(accountId)) {
      throw new Error('VITE_REGISTRY_ACCOUNT_ID must be the deployed NEAR testnet account ID.');
    }
  }

  async initialize(): Promise<void> {
    const response = await fetch(ABI_URL);
    if (!response.ok) {
      throw new Error(`Could not load contract ABI (${response.status}).`);
    }
    this.abi = (await response.json()) as RegistryAbi;
  }

  async getTraders(): Promise<Trader[]> {
    const records = await this.view<TraderRecord[]>('get_traders', {
      from_index: 0,
      limit: 100,
    });
    const traders: Trader[] = [];
    for (let index = 0; index < records.length; index += 8) {
      const batch = records.slice(index, index + 8);
      const withSnapshots = await Promise.all(
        batch.map(async (record) => {
          const snapshots = await this.view<PnlSnapshot[]>('get_pnl_snapshots', {
            trader_id: record.account_id,
            limit: 90,
          });
          return toTrader(record, snapshots);
        }),
      );
      traders.push(...withSnapshots);
    }
    return traders;
  }

  getSubscription(traderId: string, followerId: string): Promise<Subscription | null> {
    return this.view('get_subscription', {
      trader_id: traderId,
      follower_id: followerId,
    });
  }

  getPnlSnapshots(traderId: string): Promise<PnlSnapshot[]> {
    return this.view('get_pnl_snapshots', { trader_id: traderId, limit: 90 });
  }

  async call(
    methodName: ChangeMethod,
    args: Record<string, unknown>,
    wallet: Pick<Wallet, 'signAndSendTransaction'>,
    signerId: string,
    deposit: string,
  ): Promise<Awaited<ReturnType<Wallet['signAndSendTransaction']>>> {
    this.assertMethod(methodName, 'call');
    const action = actionCreators.functionCall(
      methodName,
      args,
      100_000_000_000_000n,
      BigInt(deposit),
    );
    return wallet.signAndSendTransaction({
      signerId,
      receiverId: this.accountId,
      actions: [action],
    });
  }

  private async view<T>(methodName: ViewMethod, args: object): Promise<T> {
    this.assertMethod(methodName, 'view');
    const argsBase64 = bytesToBase64(new TextEncoder().encode(JSON.stringify(args)));
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'umbra-registry',
        method: 'query',
        params: {
          request_type: 'call_function',
          finality: 'final',
          account_id: this.accountId,
          method_name: methodName,
          args_base64: argsBase64,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`NEAR testnet RPC returned HTTP ${response.status}.`);
    }
    const result = (await response.json()) as RpcResponse<{ result: number[] }>;
    if (result.error) {
      throw new Error(`NEAR RPC error: ${result.error.message}`);
    }
    if (result.result?.error) {
      if (result.result.error.includes('The contract is not initialized')) {
        throw new Error(
          `The contract account ${this.accountId} is deployed but not initialized. The owner must call new(owner_id, attestor_id, protocol_fee_bps) once before the registry can be used.`,
        );
      }
      throw new Error(`Contract view failed: ${result.result.error}`);
    }
    if (!result.result) {
      throw new Error(`NEAR RPC returned no result for ${methodName}.`);
    }
    const output = new TextDecoder().decode(new Uint8Array(result.result.result));
    try {
      return JSON.parse(output) as T;
    } catch {
      throw new Error(`Contract returned invalid JSON for ${methodName}.`);
    }
  }

  private assertMethod(methodName: string, kind: 'view' | 'call'): void {
    const methods = this.abi?.body.functions;
    if (!methods) {
      throw new Error('Contract ABI has not been loaded.');
    }
    if (!methods.some((method) => method.name === methodName && method.kind === kind)) {
      throw new Error(`The loaded contract ABI does not expose ${kind} method ${methodName}.`);
    }
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
