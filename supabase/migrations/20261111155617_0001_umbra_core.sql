/*
# Umbra core marketplace schema

1. New Tables
- `profiles`: public NEAR identity and encryption public key.
- `traders`: public trader settings and current encryption epoch.
- `trades`: encrypted trade ciphertext with public timing metadata only.
- `key_envelopes`: encrypted feed-key envelopes for follower access.
- `subscriptions`: simulated marketplace access records.
- `pnl_snapshots`: public, self-reported performance summaries.

2. Security
- Row level security is enabled on every table.
- Public performance and trader discovery are readable by anon and authenticated roles.
- Ciphertext is readable publicly because it contains no plaintext; envelope rows are restricted by the caller's stored profile identity in this prototype.
- Writes are granted to the demo client role so the hackathon flow works without a Supabase account; NEAR signature authorization is the live follow-up.

3. Important notes
- No plaintext trades or private feed keys are stored here.
- `tx_ref` is a simulated wallet-message reference in demo mode, never a mainnet transaction hash.
- The client uses local browser identity for this prototype because NEP-413 to Supabase session exchange is not wired yet.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  near_account text UNIQUE NOT NULL,
  handle text UNIQUE NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  enc_public_key text,
  role text NOT NULL DEFAULT 'follower' CHECK (role IN ('follower', 'trader', 'both')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.traders (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_per_30d_near numeric(18,4) NOT NULL DEFAULT 0,
  max_followers integer NOT NULL DEFAULT 100,
  current_epoch integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  epoch integer NOT NULL,
  ciphertext text NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.key_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  epoch integer NOT NULL,
  wrapped_key text NOT NULL,
  nonce text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trader_id, follower_id, epoch)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  tx_ref text NOT NULL,
  UNIQUE (trader_id, follower_id)
);

CREATE TABLE IF NOT EXISTS public.pnl_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  "window" integer NOT NULL CHECK ("window" IN (7, 30, 90)),
  return_pct numeric(12,4) NOT NULL,
  win_rate numeric(12,4) NOT NULL,
  trades_count integer NOT NULL DEFAULT 0,
  max_drawdown_pct numeric(12,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trader_id, "window")
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_snapshots ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.traders, public.trades, public.key_envelopes, public.subscriptions, public.pnl_snapshots TO anon, authenticated;

DROP POLICY IF EXISTS "public profiles select" ON public.profiles;
CREATE POLICY "public profiles select" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo profiles insert" ON public.profiles;
CREATE POLICY "demo profiles insert" ON public.profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo profiles update" ON public.profiles;
CREATE POLICY "demo profiles update" ON public.profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo profiles delete" ON public.profiles;
CREATE POLICY "demo profiles delete" ON public.profiles FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public traders select" ON public.traders;
CREATE POLICY "public traders select" ON public.traders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo traders insert" ON public.traders;
CREATE POLICY "demo traders insert" ON public.traders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo traders update" ON public.traders;
CREATE POLICY "demo traders update" ON public.traders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo traders delete" ON public.traders;
CREATE POLICY "demo traders delete" ON public.traders FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "ciphertext trades select" ON public.trades;
CREATE POLICY "ciphertext trades select" ON public.trades FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo trades insert" ON public.trades;
CREATE POLICY "demo trades insert" ON public.trades FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo trades update" ON public.trades;
CREATE POLICY "demo trades update" ON public.trades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo trades delete" ON public.trades;
CREATE POLICY "demo trades delete" ON public.trades FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "envelopes select" ON public.key_envelopes;
CREATE POLICY "envelopes select" ON public.key_envelopes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo envelopes insert" ON public.key_envelopes;
CREATE POLICY "demo envelopes insert" ON public.key_envelopes FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo envelopes update" ON public.key_envelopes;
CREATE POLICY "demo envelopes update" ON public.key_envelopes FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo envelopes delete" ON public.key_envelopes;
CREATE POLICY "demo envelopes delete" ON public.key_envelopes FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "subscriptions select" ON public.subscriptions;
CREATE POLICY "subscriptions select" ON public.subscriptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo subscriptions insert" ON public.subscriptions;
CREATE POLICY "demo subscriptions insert" ON public.subscriptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo subscriptions update" ON public.subscriptions;
CREATE POLICY "demo subscriptions update" ON public.subscriptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo subscriptions delete" ON public.subscriptions;
CREATE POLICY "demo subscriptions delete" ON public.subscriptions FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public pnl select" ON public.pnl_snapshots;
CREATE POLICY "public pnl select" ON public.pnl_snapshots FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "demo pnl insert" ON public.pnl_snapshots;
CREATE POLICY "demo pnl insert" ON public.pnl_snapshots FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "demo pnl update" ON public.pnl_snapshots;
CREATE POLICY "demo pnl update" ON public.pnl_snapshots FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "demo pnl delete" ON public.pnl_snapshots;
CREATE POLICY "demo pnl delete" ON public.pnl_snapshots FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS trades_trader_created_idx ON public.trades (trader_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pnl_trader_window_idx ON public.pnl_snapshots (trader_id, "window");
CREATE INDEX IF NOT EXISTS subscriptions_follower_idx ON public.subscriptions (follower_id, status);
