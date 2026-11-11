# Umbra

Umbra is a private social trading prototype for the NEAR Hackathon: traders keep positions encrypted, publish a public PnL record, and sell time-limited viewing keys to followers.

> Trade in the dark. Be followed in the light.

## Judge flow

1. Open the landing page and select **Connect wallet**. The demo wallet is local-only and moves no funds.
2. Open **Explore**, choose a trader, and select **Subscribe**. The locked feed animates into an unlocked feed.
3. Open **Following** to see the active key, expiry, and copy-trade controls.
4. Open **Studio**, publish a trade, and see the private trade appear in the encrypted publish list.
5. Open **How it works** for the privacy model and explicit limits.

## Architecture

- Vite, React, TypeScript, Tailwind CSS, React Router, Recharts, Framer Motion, Lucide.
- Browser crypto uses `tweetnacl`: secretbox encrypts trades, and box envelopes model follower access.
- Supabase stores profiles, trader settings, ciphertext trades, envelopes, subscriptions, and public PnL snapshots.
- The current UI uses a local demo session so the first run works without a wallet extension. `src/lib/supabase.ts` enables persistence when public Supabase variables are available.
- NEAR wallet selector and NEAR Intents integration are represented by adapter-ready demo behavior; no real wallet transaction or fund movement occurs.

## Privacy model and limits

Plaintext trade payloads are encrypted before storage. Public data includes handles, pricing, follower count, timing metadata, and self-reported PnL. A follower with access can copy or share decrypted trades, and public timing can reveal activity patterns. Demo-mode RLS intentionally allows anonymous writes so judges can exercise the flow; a live deployment should exchange a NEP-413 signature for a Supabase session and narrow write policies to the signed trader.

## Mock vs live

Mocked: wallet connection, subscription payment, Intents quotes and fills, PnL verification, demo seed data, and copy-trade execution. To wire live: finish NEP-413 auth exchange, use the NEAR wallet selector modal, proxy dry-run Intents quotes through an Edge Function, add the provided registry ABI and address, and replace demo RLS writes with ownership checks. Demo mode never displays a fake mainnet transaction hash.

## Libraries

React, React Router, Tailwind CSS, Recharts, Framer Motion, Lucide React, tweetnacl, Supabase JS, and Vitest.

## Run locally

Install dependencies with `npm install`, copy `.env.example` to `.env`, and use the Vite development workflow. The app defaults to demo mode and does not require a wallet extension.

## Environment variables

`VITE_MODE=demo|live`, public Supabase URL and anon key, and `VITE_REGISTRY_ADDRESS` for a future Aurora registry deployment. Never commit secrets.

## Deployment

Netlify is configured with `netlify.toml` for a single-page app redirect and the production build command. Use demo mode for the hackathon presentation until live adapters and NEP-413 auth are connected.
