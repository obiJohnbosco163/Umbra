import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CircleHelp,
  KeyRound,
  Lock,
  Menu,
  Moon,
  RefreshCw,
  Shield,
  Wallet,
} from 'lucide-react';
import { useRegistry } from '@/near/useRegistry';
import {
  formatYoctoNear,
  isValidX25519PublicKey,
  parseNearToYocto,
} from '@/near/registry';
import { createIdentity } from '@/crypto/umbraCrypto';
import type { Subscription, Trader } from '@/types/market';

const yellow = '#FFD000';
const coral = '#FF5C6C';
const ink = '#0D0D0F';
const bone = '#F6F1E7';
const STORAGE_DEPOSIT_YOCTO = '20000000000000000000000';
const NANOS_PER_MILLISECOND = 1_000_000n;

function UmbraLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="Umbra logo" role="img">
      <circle cx="19" cy="20" r="14" fill={yellow} />
      <path d="M27 6c-9 3-14 10-14 18 0 6 3 11 8 14-9-1-16-8-16-17C5 11 13 3 23 3c2 0 3 1 4 3Z" fill={ink} />
      <path d="M27 6c-7 4-10 10-10 17 0 7 4 12 10 15-8 0-15-7-15-16 0-8 5-14 15-16Z" fill={coral} opacity=".92" />
    </svg>
  );
}

function App() {
  const registry = useRegistry();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const session = registry.accountId ? { account: registry.accountId } : null;

  useEffect(() => {
    if (!registry.error) return;
    setToast(registry.error);
    const timer = window.setTimeout(() => setToast(''), 6000);
    return () => window.clearTimeout(timer);
  }, [registry.error]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  return (
    <BrowserRouter>
      <div className="grain min-h-screen bg-[#0D0D0F] text-[#F6F1E7]">
        <Header
          session={session}
          connect={registry.connect}
          disconnect={() => void registry.disconnect()}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
        {(registry.configurationError || registry.error) && (
          <div className="border-b border-[#FF5C6C]/30 bg-[#FF5C6C]/10 px-5 py-3 text-center text-sm text-[#F6F1E7]">
            {registry.configurationError ?? registry.error}
          </div>
        )}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="fixed right-5 top-20 z-40 max-w-md rounded-xl border border-[#FFD000]/40 bg-[#171719] px-4 py-3 text-sm text-[#F6F1E7] shadow-2xl"
            >
              <Check size={16} className="mr-2 inline text-[#FFD000]" />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        <Routes>
          <Route path="/" element={<Landing traders={registry.traders} loading={registry.loading} />} />
          <Route path="/explore" element={<Explore traders={registry.traders} loading={registry.loading} />} />
          <Route
            path="/t/:handle"
            element={
              <Profile
                accountId={registry.accountId}
                traders={registry.traders}
                loading={registry.loading}
                connect={registry.connect}
                getSubscription={registry.getSubscription}
                call={registry.call}
                notify={notify}
              />
            }
          />
          <Route
            path="/following"
            element={
              <Following
                accountId={registry.accountId}
                traders={registry.traders}
                getSubscription={registry.getSubscription}
              />
            }
          />
          <Route path="/studio" element={<Studio notify={notify} />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

function Header({
  session,
  connect,
  disconnect,
  menuOpen,
  setMenuOpen,
}: {
  session: { account: string } | null;
  connect: () => void;
  disconnect: () => void;
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[.08] bg-[#0D0D0F]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between px-5 lg:px-10">
        <Link to="/" className="focus-ring flex items-center gap-3">
          <UmbraLogo size={30} />
          <span className="font-display text-[21px] font-semibold tracking-[-.04em]">umbra</span>
        </Link>
        <nav className="hidden items-center gap-9 md:flex">
          <NavLink to="/explore" className={navClass}>Explore</NavLink>
          <NavLink to="/following" className={navClass}>Dashboard</NavLink>
          <NavLink to="/studio" className={navClass}>Studio</NavLink>
          <NavLink to="/how-it-works" className={navClass}>How it works</NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-[#FFD000]/30 bg-[#FFD000]/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#FFD000] sm:inline">
            NEAR testnet
          </span>
          {session ? (
            <button
              onClick={disconnect}
              title="Disconnect wallet"
              className="focus-ring max-w-48 truncate rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:border-[#FFD000]/50"
            >
              {session.account}
            </button>
          ) : (
            <button
              onClick={connect}
              className="focus-ring rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium transition hover:border-[#FFD000]/60 hover:bg-white/[.03]"
            >
              Connect wallet
            </button>
          )}
          <button
            aria-label="Open menu"
            className="focus-ring p-2 md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="border-t border-white/10 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link onClick={() => setMenuOpen(false)} to="/explore">Explore</Link>
            <Link onClick={() => setMenuOpen(false)} to="/following">Dashboard</Link>
            <Link onClick={() => setMenuOpen(false)} to="/studio">Studio</Link>
            <Link onClick={() => setMenuOpen(false)} to="/how-it-works">How it works</Link>
          </div>
        </nav>
      )}
    </header>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `text-sm transition ${isActive ? 'text-[#FFD000]' : 'text-[#F6F1E7]/65 hover:text-[#F6F1E7]'}`;
}

function Shell({
  children,
  eyebrow,
  title,
  intro,
}: {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  intro?: string;
}) {
  return (
    <main className="mx-auto max-w-[1280px] px-5 pb-24 pt-14 lg:px-10 lg:pt-20">
      {eyebrow && (
        <div className="mb-5 font-mono text-[10px] uppercase tracking-[.2em] text-[#FFD000]">
          {eyebrow}
        </div>
      )}
      <h1 className="font-display text-4xl font-semibold tracking-[-.055em] sm:text-6xl">{title}</h1>
      {intro && <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#F6F1E7]/60">{intro}</p>}
      {children}
    </main>
  );
}

function Button({
  children,
  secondary,
  onClick,
  to,
  icon,
  disabled,
}: {
  children: ReactNode;
  secondary?: boolean;
  onClick?: () => void;
  to?: string;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const cls = `focus-ring inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${secondary ? 'border border-white/10 text-[#F6F1E7] hover:border-[#FFD000]/50 hover:bg-white/[.04]' : 'bg-[#FFD000] text-[#0D0D0F] hover:bg-[#ffe04d]'}`;
  if (to) return <Link className={cls} to={to}>{children}{icon}</Link>;
  return <button className={cls} onClick={onClick} disabled={disabled}>{children}{icon}</button>;
}

function Stat({ label, value, tone = 'bone' }: { label: string; value: string; tone?: 'yellow' | 'coral' | 'bone' }) {
  return (
    <div className="card p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#F6F1E7]/45">{label}</div>
      <div className={`mt-4 font-mono text-2xl ${tone === 'yellow' ? 'text-[#FFD000]' : tone === 'coral' ? 'text-[#FF5C6C]' : ''}`}>{value}</div>
    </div>
  );
}

function Landing({ traders, loading }: { traders: Trader[]; loading: boolean }) {
  const leaders = useMemo(
    () => [...traders].sort((a, b) => (b.return30 ?? -Infinity) - (a.return30 ?? -Infinity)).slice(0, 3),
    [traders],
  );
  return (
    <main>
      <section className="mx-auto grid max-w-[1280px] items-center gap-16 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-7 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.2em] text-[#FFD000]">
            <span className="h-px w-8 bg-[#FFD000]" /> Private trading. Public proof.
          </div>
          <h1 className="font-display text-[clamp(3.4rem,8vw,7.3rem)] font-semibold leading-[.94] tracking-[-.07em]">
            Trade in the dark.<br /><span className="text-[#F6F1E7]/95">Be followed</span><br />in the light.
          </h1>
          <p className="mt-8 max-w-lg text-base leading-relaxed text-[#F6F1E7]/60">
            Trader profiles and subscriptions are read from the UmbraRegistry deployed on NEAR testnet.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button to="/explore" icon={<ArrowRight size={16} />}>Explore traders</Button>
          </div>
          <div className="mt-7 flex items-center gap-5 font-mono text-[10px] uppercase tracking-widest text-[#F6F1E7]/35">
            <span><Shield size={13} className="mr-1 inline text-[#FFD000]" />Non-custodial</span>
            <span>NEAR testnet</span>
          </div>
        </div>
        <div className="hero-orbit relative min-h-[450px] overflow-hidden rounded-[32px] border border-white/[.08] bg-[#111113] p-7 lg:min-h-[560px]">
          <div className="relative z-10 flex items-center justify-between font-mono text-[9px] uppercase tracking-[.18em] text-[#F6F1E7]/40">
            <span>On-chain registry</span>
            <span className="flex items-center gap-2 text-[#FFD000]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFD000]" /> Testnet
            </span>
          </div>
          <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 60% 35%, rgba(255,208,0,.2), transparent 36%), radial-gradient(circle at 57% 40%, rgba(255,92,108,.18), transparent 32%)' }} />
          <div className="absolute left-[19%] top-[12%] h-72 w-72 rounded-full bg-[#FFD000] shadow-[0_0_100px_rgba(255,208,0,.15)] sm:h-96 sm:w-96" />
          <div className="absolute left-[34%] top-[11%] h-72 w-72 rounded-full bg-[#0D0D0F] sm:h-96 sm:w-96" />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute bottom-9 left-6 right-6 rounded-2xl border border-white/10 bg-[#111113]/90 p-5 backdrop-blur-xl sm:left-12 sm:right-12"
          >
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest">
              <span className="text-[#FFD000]">Registered traders</span><Lock size={15} className="text-[#FF5C6C]" />
            </div>
            <div className="mt-4 font-mono text-4xl text-[#FFD000]">{loading ? '…' : traders.length}</div>
            <div className="mt-2 text-xs text-[#F6F1E7]/45">Profiles read directly from contract state</div>
          </motion.div>
        </div>
      </section>
      <section className="mx-auto max-w-[1280px] px-5 pb-28 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[.2em] text-[#FFD000]">Testnet leaderboard</div>
            <h2 className="font-display text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Traders on-chain.</h2>
          </div>
          <Link to="/explore" className="text-sm text-[#F6F1E7]/60 hover:text-[#FFD000]">Explore all traders <ArrowRight size={15} className="ml-1 inline" /></Link>
        </div>
        <div className="mt-8 space-y-3">
          {leaders.map((trader, index) => <TraderRow key={trader.id} trader={trader} rank={index + 1} />)}
          {!loading && !leaders.length && <Empty icon={<Moon />} title="No traders registered yet" text="When traders register on this contract, their profiles will appear here." />}
        </div>
      </section>
      <Footer />
    </main>
  );
}

function TraderRow({ trader, rank }: { trader: Trader; rank?: number }) {
  return (
    <Link to={`/t/${trader.handle}`} className="card card-hover flex flex-wrap items-center gap-4 p-4 sm:grid sm:grid-cols-[1.6fr_repeat(4,1fr)_auto] sm:gap-5">
      <div className="flex min-w-[220px] items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full border border-[#FFD000]/50"><UmbraLogo size={24} /></div>
        <div>
          <div className="font-medium">{rank && <span className="mr-3 font-mono text-xs text-[#F6F1E7]/30">{String(rank).padStart(2, '0')}</span>}{trader.handle}</div>
          <div className="mt-1 text-[11px] text-[#FFD000]">{trader.active ? 'Accepting followers' : 'Not accepting followers'} · {trader.specialty}</div>
        </div>
      </div>
      <Metric label="30d return" value={formatMetric(trader.return30, '%')} tone={(trader.return30 ?? 0) >= 0 ? 'yellow' : 'coral'} />
      <Metric label="Win rate" value={formatMetric(trader.winRate, '%')} />
      <Metric label="Max drawdown" value={formatMetric(trader.drawdown, '%')} tone="coral" />
      <Metric label="Followers" value={`${trader.followers}`} />
      <ArrowRight className="hidden text-[#F6F1E7]/30 sm:block" size={18} />
    </Link>
  );
}

function Metric({ label, value, tone = 'bone' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-[90px]">
      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F6F1E7]/35">{label}</div>
      <div className={`mt-2 font-mono text-sm ${tone === 'yellow' ? 'text-[#FFD000]' : tone === 'coral' ? 'text-[#FF5C6C]' : ''}`}>{value}</div>
    </div>
  );
}

function Explore({ traders, loading }: { traders: Trader[]; loading: boolean }) {
  const [query, setQuery] = useState('');
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [sort, setSort] = useState('return');
  const filtered = useMemo(() => {
    const returnForWindow = (trader: Trader) =>
      windowDays === 7 ? trader.return7 : windowDays === 90 ? trader.return90 : trader.return30;
    return traders
      .filter((trader) => trader.handle.includes(query.toLowerCase()))
      .sort((a, b) =>
        sort === 'price'
          ? BigInt(a.priceYocto) < BigInt(b.priceYocto)
            ? -1
            : BigInt(a.priceYocto) > BigInt(b.priceYocto)
              ? 1
              : 0
          : (returnForWindow(b) ?? -Infinity) - (returnForWindow(a) ?? -Infinity),
      );
  }, [query, sort, traders, windowDays]);
  return (
    <Shell eyebrow="01 / Discover the edge" title="Explore traders" intro="Profiles, terms, and attestations read from the UmbraRegistry on NEAR testnet.">
      <div className="mt-10 flex flex-col gap-3 border-y border-white/[.08] py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {([7, 30, 90] as const).map((value) => (
            <button key={value} onClick={() => setWindowDays(value)} className={`focus-ring rounded-lg px-4 py-2 text-sm ${windowDays === value ? 'bg-[#FFD000] font-semibold text-[#0D0D0F]' : 'border border-white/10 text-[#F6F1E7]/55'}`}>{value}d</button>
          ))}
        </div>
        <div className="flex gap-3">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search handle" className="focus-ring w-full rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-[#F6F1E7]/30 sm:w-48" />
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="focus-ring rounded-lg border border-white/10 bg-[#0D0D0F] px-3 py-2 text-sm text-[#F6F1E7]/70">
            <option value="return">Sort: return</option><option value="price">Sort: price</option>
          </select>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {filtered.map((trader, index) => <TraderRow key={trader.id} trader={trader} rank={index + 1} />)}
        {loading && <div className="py-8 text-center text-sm text-[#F6F1E7]/50">Reading trader records from NEAR testnet…</div>}
        {!loading && !filtered.length && <Empty icon={<Moon />} title={traders.length ? 'No matching traders' : 'No traders registered yet'} text={traders.length ? 'Try another handle.' : 'Profiles will appear here after they are registered on-chain.'} />}
      </div>
    </Shell>
  );
}

function Profile({
  accountId,
  traders,
  loading,
  connect,
  getSubscription,
  call,
  notify,
}: {
  accountId: string | null;
  traders: Trader[];
  loading: boolean;
  connect: () => void;
  getSubscription: (traderId: string, followerId: string) => Promise<Subscription | null>;
  call: (method: 'register_trader' | 'subscribe', args: Record<string, unknown>, deposit: string) => Promise<void>;
  notify: (message: string) => void;
}) {
  const { handle = '' } = useParams();
  const trader = traders.find((item) => item.handle === handle);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSubscription(null);
    if (accountId && trader) {
      void getSubscription(trader.id, accountId)
        .then((value) => { if (active) setSubscription(value); })
        .catch((cause: unknown) => { if (active) setFailure(errorMessage(cause)); });
    }
    return () => { active = false; };
  }, [accountId, getSubscription, trader]);

  if (!trader) {
    return <Shell eyebrow="02 / Public record" title={loading ? 'Loading trader…' : 'Trader not found'} intro={loading ? 'Reading the registry on NEAR testnet.' : `No on-chain trader has the handle “${handle}”.`}>
      {!loading && <Button to="/explore" icon={<ArrowRight size={15} />}>Back to traders</Button>}
    </Shell>;
  }

  const isSubscribed =
    !!subscription &&
    !subscription.revoked &&
    BigInt(subscription.expires_at) > BigInt(Date.now()) * NANOS_PER_MILLISECOND;
  const chartData = trader.snapshots.map((snapshot) => ({
    day: new Date(Number(BigInt(snapshot.timestamp) / NANOS_PER_MILLISECOND)).toLocaleDateString(),
    value: snapshot.return_bps / 100,
  }));
  const subscribe = async () => {
    if (!accountId) {
      connect();
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await call('subscribe', { trader_id: trader.accountId }, trader.priceYocto);
      setSubscription(await getSubscription(trader.accountId, accountId));
      notify('Subscription transaction confirmed on NEAR testnet.');
    } catch (cause) {
      const message = errorMessage(cause);
      setFailure(message);
      notify(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell eyebrow="02 / Public record" title={trader.handle} intro={trader.bio}>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[#FFD000]/30 bg-[#FFD000]/10 px-3 py-1.5 text-xs text-[#FFD000]">{trader.active ? 'Accepting followers' : 'Not accepting followers'} · {trader.specialty}</span>
        <span className="rounded-full border border-[#FF5C6C]/30 bg-[#FF5C6C]/10 px-3 py-1.5 text-xs text-[#FF5C6C]"><Lock size={12} className="mr-1 inline" />Trades remain off-chain</span>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5 sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#F6F1E7]/45">Latest 30-day attestation</div>
              <div className={`mt-3 font-mono text-4xl ${(trader.return30 ?? 0) >= 0 ? 'text-[#FFD000]' : 'text-[#FF5C6C]'}`}>{formatMetric(trader.return30, '%')}</div>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFD000]">On-chain snapshot</div>
          </div>
          {chartData.length ? (
            <div className="mt-7 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={yellow} stopOpacity={.25} /><stop offset="100%" stopColor={yellow} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="rgba(246,241,231,.08)" vertical={false} />
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip contentStyle={{ background: ink, border: '1px solid rgba(246,241,231,.15)', borderRadius: 10 }} labelStyle={{ color: bone }} />
                  <Area type="monotone" dataKey="value" stroke={(trader.return30 ?? 0) >= 0 ? yellow : coral} fill="url(#gold)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-7 grid h-64 place-items-center text-center text-sm text-[#F6F1E7]/45">No PnL snapshots have been attested for this trader.</div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Stat label="Win rate" value={formatMetric(trader.winRate, '%')} tone="yellow" />
          <Stat label="Max drawdown" value={formatMetric(trader.drawdown, '%')} tone="coral" />
          <Stat label="Active followers" value={`${trader.followers}`} />
          <Stat label="Key epoch" value={`${trader.currentEpoch}`} />
        </div>
      </div>
      <div className="mt-16 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-.04em]">Private positions stay private.</h2>
          <p className="mt-2 text-sm text-[#F6F1E7]/50">This registry exposes access status and encrypted-envelope pointers only. Trade records are not stored by the contract.</p>
          {isSubscribed && (
            <div className="card mt-6 p-5 text-sm">
              <div className="text-[#FFD000]"><KeyRound size={14} className="mr-2 inline" />Subscription active</div>
              <div className="mt-2 text-[#F6F1E7]/55">Granted key epoch: {subscription?.epoch_granted}. Expiry: {formatExpiry(subscription!.expires_at)}.</div>
              {subscription?.epoch_granted !== trader.currentEpoch && <div className="mt-2 text-[#FF5C6C]">The trader has rotated keys; the current epoch has not yet been granted.</div>}
            </div>
          )}
        </div>
        <div className="card h-fit p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#FF5C6C]"><KeyRound size={14} className="mr-1 inline" />Testnet subscription</span>
            <Shield size={18} className="text-[#FFD000]" />
          </div>
          <h3 className="mt-6 font-display text-2xl font-semibold">{formatYoctoNear(trader.priceYocto)} NEAR</h3>
          <p className="mt-3 text-sm leading-relaxed text-[#F6F1E7]/55">
            Access period: {formatDuration(trader.periodSeconds)}.<br />
            Payment is sent to the registry contract.<br />
            No return is guaranteed.
          </p>
          <Button
            onClick={() => void subscribe()}
            disabled={busy || (!trader.active && !isSubscribed)}
            icon={busy ? <RefreshCw className="animate-spin" size={15} /> : isSubscribed ? <Check size={15} /> : <KeyRound size={15} />}
          >
            {busy ? 'Waiting for testnet…' : isSubscribed ? 'Renew subscription' : `Subscribe · ${formatYoctoNear(trader.priceYocto)} NEAR`}
          </Button>
          {failure && <p role="alert" className="mt-3 text-xs text-[#FF5C6C]">{failure}</p>}
          {isSubscribed && <Link to="/following" className="mt-3 block text-center text-xs text-[#FFD000]">View your subscriptions <ArrowRight size={13} className="ml-1 inline" /></Link>}
        </div>
      </div>
    </Shell>
  );
}

function Following({
  accountId,
  traders,
  getSubscription,
}: {
  accountId: string | null;
  traders: Trader[];
  getSubscription: (traderId: string, followerId: string) => Promise<Subscription | null>;
}) {
  const [subscriptions, setSubscriptions] = useState<Array<{ trader: Trader; value: Subscription }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!accountId) {
      setSubscriptions([]);
      return () => { active = false; };
    }
    setLoading(true);
    setError(null);
    void Promise.all(
      traders.map(async (trader) => ({
        trader,
        value: await getSubscription(trader.accountId, accountId),
      })),
    )
      .then((results) => {
        if (active) {
          const now = BigInt(Date.now()) * NANOS_PER_MILLISECOND;
          setSubscriptions(results.filter(({ value }) => value && !value.revoked && BigInt(value.expires_at) > now) as Array<{ trader: Trader; value: Subscription }>);
        }
      })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, getSubscription, traders]);

  return (
    <Shell eyebrow="03 / Your access" title="Following" intro="Active subscriptions checked against the contract for your connected wallet.">
      {!accountId ? (
        <div className="mt-10 card p-6 text-sm text-[#F6F1E7]/60">Connect a NEAR testnet wallet to check your subscriptions.</div>
      ) : (
        <div className="mt-10 space-y-4">
          {subscriptions.map(({ trader, value }) => (
            <div className="card p-6" key={trader.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Link to={`/t/${trader.handle}`} className="font-display text-2xl font-semibold hover:text-[#FFD000]">{trader.handle}</Link>
                  <div className="mt-2 text-xs text-[#FFD000]"><KeyRound size={13} className="mr-1 inline" />Access active · expires {formatExpiry(value.expires_at)}</div>
                </div>
                <span className="rounded-full bg-[#FFD000]/10 px-3 py-1.5 text-xs text-[#FFD000]">On-chain</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric label="Price / period" value={`${formatYoctoNear(trader.priceYocto)} NEAR`} />
                <Metric label="Granted key epoch" value={`${value.epoch_granted}`} />
                <Metric label="Current key epoch" value={`${trader.currentEpoch}`} tone={value.epoch_granted === trader.currentEpoch ? 'yellow' : 'coral'} />
              </div>
            </div>
          ))}
          {loading && <div className="py-8 text-center text-sm text-[#F6F1E7]/50">Checking subscriptions on NEAR testnet…</div>}
          {error && <p role="alert" className="text-sm text-[#FF5C6C]">{error}</p>}
          {!loading && !error && !subscriptions.length && (
            <Empty icon={<KeyRound />} title="No active subscriptions" text="Subscriptions will appear here after a confirmed testnet transaction." action={<Button to="/explore" icon={<ArrowRight size={15} />}>Explore traders</Button>} />
          )}
          <p className="text-xs leading-relaxed text-[#F6F1E7]/40">Umbra does not execute copy trades. This dashboard displays subscription state only.</p>
        </div>
      )}
    </Shell>
  );
}

function Studio({ notify }: { notify: (message: string) => void }) {
  const { accountId, connect, traders, call } = useRegistry();
  const [handle, setHandle] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [identityBackup, setIdentityBackup] = useState<{ url: string; filename: string } | null>(null);
  const [price, setPrice] = useState('0.1');
  const [period, setPeriod] = useState('2592000');
  const [maxFollowers, setMaxFollowers] = useState('100');
  const [busy, setBusy] = useState(false);
  const existing = traders.find((trader) => trader.accountId === accountId);

  useEffect(
    () => () => {
      if (identityBackup) URL.revokeObjectURL(identityBackup.url);
    },
    [identityBackup],
  );

  const generateIdentity = () => {
    const identity = createIdentity();
    const identityFile = new Blob(
      [
        JSON.stringify(
          {
            algorithm: 'X25519',
            publicKey: identity.publicKey,
            secretKey: identity.secretKey,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const filename = `umbra-x25519-identity-${Date.now()}.json`;
    const url = URL.createObjectURL(identityFile);
    setPublicKey(identity.publicKey);
    setIdentityBackup({ url, filename });
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) {
      connect();
      return;
    }
    try {
      const normalizedHandle = handle.trim();
      if (!/^[a-z0-9_]{3,32}$/.test(normalizedHandle)) {
        throw new Error('Handle must be 3–32 characters using lowercase letters, numbers, or underscores.');
      }
      if (!isValidX25519PublicKey(publicKey.trim())) {
        throw new Error('Enter a valid Base64 X25519 public key that decodes to exactly 32 bytes.');
      }
      if (traders.some((trader) => trader.handle === normalizedHandle)) {
        throw new Error('That handle is already registered. Choose a different handle.');
      }
      const priceYocto = parseNearToYocto(price);
      if (BigInt(priceYocto) === 0n) {
        throw new Error('Subscription price must be greater than zero.');
      }
      const periodSeconds = Number(period);
      const followerLimit = Number(maxFollowers);
      if (!Number.isInteger(periodSeconds) || periodSeconds < 1 || periodSeconds > 0xffff_ffff) {
        throw new Error('Period must be a whole number between 1 and 4,294,967,295 seconds.');
      }
      if (!Number.isInteger(followerLimit) || followerLimit < 1 || followerLimit > 0xffff_ffff) {
        throw new Error('Maximum followers must be a whole number between 1 and 4,294,967,295.');
      }

      setBusy(true);
      await call(
        'register_trader',
        {
          handle: normalizedHandle,
          enc_pub_key: publicKey.trim(),
          price_per_period: priceYocto,
          period_seconds: periodSeconds,
          max_followers: followerLimit,
        },
        STORAGE_DEPOSIT_YOCTO,
      );
      notify('Trader registration confirmed on NEAR testnet.');
    } catch (cause) {
      notify(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell eyebrow="04 / Trader studio" title="Register on-chain." intro="Register your public trader profile and subscription terms on the deployed NEAR testnet contract.">
      {existing ? (
        <div className="mt-10 card p-6">
          <div className="text-[#FFD000]"><Check size={16} className="mr-2 inline" />This wallet is registered.</div>
          <div className="mt-3 text-sm text-[#F6F1E7]/60">Handle: {existing.handle}. Price: {formatYoctoNear(existing.priceYocto)} NEAR per {formatDuration(existing.periodSeconds)}. Current key epoch: {existing.currentEpoch}.</div>
          <p className="mt-4 text-sm text-[#F6F1E7]/45">Terms management and PnL attestations are not exposed in this frontend yet; the contract does not store trade data.</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
          <form onSubmit={(event) => void register(event)} className="card space-y-5 p-6">
            <label className="block text-sm">Public handle
              <input required minLength={3} maxLength={32} pattern="[a-z0-9_]+" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="your_handle" className="focus-ring mt-2 w-full rounded-lg border border-white/10 bg-transparent px-4 py-3 outline-none" />
            </label>
            <div>
              <label className="block text-sm" htmlFor="trader-public-key">Base64 X25519 public key</label>
              <input id="trader-public-key" required maxLength={64} value={publicKey} onChange={(event) => {
                setPublicKey(event.target.value);
                setIdentityBackup(null);
              }} placeholder="32-byte public key, base64 encoded" className="focus-ring mt-2 w-full rounded-lg border border-white/10 bg-transparent px-4 py-3 font-mono text-xs outline-none" />
              <p className="mt-2 text-xs leading-relaxed text-[#F6F1E7]/45">
                Use an X25519 encryption public key encoded as standard Base64 (44 characters, usually ending in =). This is not your NEAR wallet public key.
              </p>
              <button type="button" onClick={generateIdentity} className="focus-ring mt-3 rounded-lg border border-[#FFD000]/35 px-3 py-2 text-xs font-medium text-[#FFD000] transition hover:bg-[#FFD000]/10">
                Generate X25519 keypair
              </button>
              {identityBackup && (
                <p role="status" className="mt-3 rounded-lg border border-[#FFD000]/25 bg-[#FFD000]/[.06] p-3 text-xs leading-relaxed text-[#F6F1E7]/70">
                  Keypair generated on this device. <a href={identityBackup.url} download={identityBackup.filename} className="font-semibold text-[#FFD000] underline">Download the private-key backup</a> and keep it somewhere secure; it cannot be recovered if lost. Only the public key above is sent to the contract.
                </p>
              )}
              {publicKey && !isValidX25519PublicKey(publicKey.trim()) && (
                <p role="alert" className="mt-2 text-xs text-[#FF5C6C]">
                  This is not a valid 32-byte X25519 public key in standard Base64. Generate a keypair here or enter the public key from your encryption identity.
                </p>
              )}
            </div>
            <label className="block text-sm">Subscription price (NEAR)
              <input required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} className="focus-ring mt-2 w-full rounded-lg border border-white/10 bg-transparent px-4 py-3 outline-none" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">Period (seconds)
                <input required type="number" min="1" value={period} onChange={(event) => setPeriod(event.target.value)} className="focus-ring mt-2 w-full rounded-lg border border-white/10 bg-transparent px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">Maximum followers
                <input required type="number" min="1" value={maxFollowers} onChange={(event) => setMaxFollowers(event.target.value)} className="focus-ring mt-2 w-full rounded-lg border border-white/10 bg-transparent px-4 py-3 outline-none" />
              </label>
            </div>
            <p className="text-xs leading-relaxed text-[#F6F1E7]/45">Registration requires an exact 0.02 NEAR storage deposit. The private key must never be entered here.</p>
            <Button disabled={busy} icon={busy ? <RefreshCw className="animate-spin" size={15} /> : <Wallet size={15} />}>
              {busy ? 'Waiting for testnet…' : accountId ? 'Register trader' : 'Connect wallet to register'}
            </Button>
          </form>
          <div className="card h-fit p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#FFD000]">Public registry only</div>
            <p className="mt-5 text-sm leading-relaxed text-[#F6F1E7]/55">The contract stores the public key, handle, price, capacity, and key epoch. Trades and private keys remain off-chain. Registration does not publish trade data or PnL.</p>
            <div className="mt-6 rounded-xl border border-white/10 p-4 text-xs leading-relaxed text-[#F6F1E7]/45">After registering, use a separate secure off-chain system for encrypted trades and key envelopes. Never submit plaintext trades or private keys to a smart contract.</div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function HowItWorks() {
  return (
    <Shell eyebrow="05 / Privacy model" title="The dark is deliberate." intro="The frontend reads public trader profiles, subscription status, and attested PnL snapshots from NEAR testnet.">
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          ['01', 'Register publicly', 'Trader accounts, public encryption keys, price, and key epoch are on-chain.'],
          ['02', 'Keep trades off-chain', 'The registry never stores trade content or private keys.'],
          ['03', 'Pay for access', 'Subscriptions and their expiration are recorded in yoctoNEAR and nanoseconds.'],
        ].map(([num, title, text]) => (
          <div className="card p-6" key={num}><div className="font-mono text-[10px] text-[#FF5C6C]">{num}</div><h3 className="mt-12 font-display text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[#F6F1E7]/55">{text}</p></div>
        ))}
      </div>
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#F6F1E7]/45"><CircleHelp size={15} className="mr-2 inline text-[#FFD000]" />PnL snapshots are assertions from the configured attestor and are not independently verified investment performance.</p>
    </Shell>
  );
}

function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center p-12 text-center">
      <div className="text-[#FFD000]">{icon}</div>
      <h2 className="mt-5 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[#F6F1E7]/50">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function NotFound() {
  return <Shell title="The eclipse moved." intro="That page is outside the current orbit."><div className="mt-10"><Button to="/" icon={<ArrowRight size={15} />}>Return home</Button></div></Shell>;
}

function Footer() {
  return (
    <footer className="mx-auto max-w-[1280px] border-t border-white/[.08] px-5 py-7 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-widest text-[#FFD000]">
        <span>NEAR testnet · Live registry data</span>
        <span className="text-[#F6F1E7]/30">Testnet only · {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}

function formatMetric(value: number | null, suffix: string): string {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`;
}

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  if (days > 0 && seconds % 86_400 === 0) return `${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.floor(seconds / 3_600);
  if (hours > 0 && seconds % 3_600 === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
  return `${seconds} seconds`;
}

function formatExpiry(timestamp: string): string {
  const milliseconds = Number(BigInt(timestamp) / NANOS_PER_MILLISECOND);
  return new Date(milliseconds).toLocaleString();
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The NEAR testnet request failed.';
}

export default App;
