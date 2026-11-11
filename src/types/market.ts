export type Trade = {
  pair: string;
  side: 'BUY' | 'SELL';
  size: number;
  price: number;
  note: string;
  timestamp: string;
};

export type PnlSnapshot = {
  timestamp: string;
  return_bps: number;
  win_rate_bps: number;
  trades_count: number;
  max_drawdown_bps: number;
  window_days: number;
  data_hash: string;
};

export type Trader = {
  id: string;
  accountId: string;
  handle: string;
  display: string;
  bio: string;
  priceYocto: string;
  periodSeconds: number;
  followers: number;
  return7: number | null;
  return30: number | null;
  return90: number | null;
  winRate: number | null;
  drawdown: number | null;
  verified: false;
  specialty: string;
  chart: number[];
  trades: Trade[];
  active: boolean;
  currentEpoch: number;
  snapshots: PnlSnapshot[];
};

export type Subscription = {
  expires_at: string;
  epoch_granted: number;
  revoked: boolean;
};
