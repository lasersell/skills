---
name: lasersell
description: AI coding skill for LaserSell covering automated exit strategies (take profit, stop loss, trailing stop), one-shot buys and sells, real-time position monitoring via WebSocket, liquidity snapshots with slippage bands, and transaction signing/submission across Raydium, Pump.fun, PumpSwap, and Meteora on Solana. SDKs in TypeScript, Python, Rust, and Go. Use when building trading bots, AI agents, portfolio tools, or any application that needs to execute trades on Solana DEXs.
---

# LaserSell SDK Development Guide

LaserSell is professional Solana execution infrastructure for automated trade exits. The SDK builds optimized unsigned transactions across Solana DEXs, signs them locally (non-custodial), and submits them via multiple backends.

## Overview

- Build unsigned buy/sell transactions via the LaserSell API with optimized DEX routing
- Exit Intelligence Stream: real-time exit signals with pre-built transactions
- Strategy options: take profit, stop loss, trailing stop, deadline timeout, sell on graduation, exit ladder, liquidity guard, breakeven trail
- Per-position strategy overrides, copy trading (watch wallets), wallet registration
- Liquidity snapshots with slippage bands and trend indicators (Tier 1+)
- Partial sells and multi-leg sells based on real-time liquidity data
- Non-custodial: private keys never leave the client
- Multi-language: TypeScript, Python, Rust, Go (all at API parity)
- Supported DEXs: Pump.fun, PumpSwap, Raydium (LaunchLab, CPMM), Meteora (DBC, DAMM v2), Bags.fm

## Install

```bash
npm install @lasersell/lasersell-sdk   # TypeScript
pip install lasersell-sdk              # Python
cargo add lasersell-sdk                # Rust
go get github.com/lasersell/lasersell-sdk/go  # Go
```

Get a free API key at https://app.lasersell.io/auth/sign-up (no credit card required).

## Quick Start: Build and Send a Sell

```typescript
import { ExitApiClient, signUnsignedTx, sendTransaction, sendTargetDefaultRpc } from "@lasersell/lasersell-sdk";

const client = ExitApiClient.withApiKey(process.env.LASERSELL_API_KEY!);
const unsignedTxB64 = await client.buildSellTxB64({
  mint: "TOKEN_MINT_ADDRESS",
  user_pubkey: "YOUR_WALLET_PUBKEY",
  amount_tokens: 1_000_000, // 0 = sell all
  slippage_bps: 2_000,      // 20%
  output: "SOL",             // "SOL" or "USD1"
});
const signedTx = signUnsignedTx(unsignedTxB64, keypair);
const signature = await sendTransaction(sendTargetDefaultRpc(), signedTx);
```

Python: `ExitApiClient.with_api_key()` → `build_sell_tx()` → `sign_unsigned_tx()` → `send_transaction()`
Rust: `ExitApiClient::with_api_key()` → `build_sell_tx()` → `sign_unsigned_tx()` → `send_transaction()`
Go: `NewExitAPIClientWithAPIKey()` → `BuildSellTx()` → `SignUnsignedTx()` → `SendTransaction()`

## Core Concepts

### Architecture

1. Client sends request to the LaserSell API (mint, amount, slippage)
2. API builds an unsigned transaction with optimal DEX routing
3. Client signs locally with their private key
4. Client submits signed transaction to Solana

Private keys never leave the client. The API only receives public keys.

### SDK Modules

| Module | Purpose |
|--------|---------|
| `exit_api` | HTTP client for building unsigned buy/sell transactions + wallet registration |
| `stream` | WebSocket client for real-time position monitoring and exit signals |
| `tx` | Transaction signing and submission |
| `retry` | Exponential backoff with jitter for transient failures |

### Tiers and Limits

| Parameter | Free (Tier 0) | Professional (Tier 1) | Advanced (Tier 2) |
|-----------|---------------|----------------------|-------------------|
| Inactivity timeout | 45 min | 24/7 | 24/7 |
| Own wallets | 1 | 5 | 200 |
| Watch wallets | 2 | 10 | 25 |
| Positions per wallet | 10 | 100 | 100 |
| Liquidity snapshots | No | Yes | Yes |
| Partner fees | No | No | Yes |

## Building Transactions

### Buy transaction

```typescript
const response = await client.buildBuyTx({
  mint: "TOKEN_MINT", user_pubkey: "WALLET_PUBKEY",
  amount: 0.1, slippage_bps: 2_000, input: "SOL",
});
```

### Optional fields (buy and sell)

| Field | Type | Description |
|-------|------|-------------|
| `send_mode` | `"rpc"` \| `"helius_sender"` \| `"astralane"` | Submission mode. Default: `"rpc"` |
| `tip_lamports` | `u64` | Priority fee tip. Default: 1,000 (0.001 SOL) |
| `partner_fee_recipient` | `Pubkey` | Fee recipient wallet (Tier 2 only) |
| `partner_fee_bps` | `u16` | Fee in bps, max 50. Exclusive with `partner_fee_lamports` |
| `partner_fee_lamports` | `u64` | Fee in lamports, max 50M. Exclusive with `partner_fee_bps` |

### Partial sell

Sell a subset of tokens when the pool cannot absorb the full position. Pairs with liquidity snapshots.

```typescript
const resp = await client.buildPartialSellTx(handle, maxTokens, { slippageBps: 500, output: "SOL" });
```

For multi-leg sells (sell in a loop checking liquidity between each leg), see [Strategy Guide](docs/strategy-guide.md).

## Wallet Registration

All wallets must be registered before connecting to the Exit Intelligence Stream. Registration proves wallet ownership via a local Ed25519 signature (no on-chain transaction).

```typescript
import { proveOwnership, ExitApiClient, StreamClient } from "@lasersell/lasersell-sdk";

const proof = proveOwnership(keypair);  // local, no network call
await ExitApiClient.withApiKey(apiKey).registerWallet(proof, "My Wallet");
```

Python: `prove_ownership(keypair)` → `client.register_wallet(proof, label="My Wallet")`
Rust: `prove_ownership(&keypair)` → `client.register_wallet(&proof, Some("My Wallet")).await?`
Go: `ProveOwnership(privateKey)` → `client.RegisterWallet(ctx, proof, Ptr("My Wallet"))`

Use `connectWithWallets` to register and connect in one step:

```typescript
const session = await new StreamClient(apiKey).connectWithWallets([proof], strategy, 120);
```

## Exit Intelligence Stream

The stream monitors positions server-side and delivers ready-to-sign exit transactions the instant conditions are met. No polling, no client-side price math.

**Important:** Connect the stream **before** submitting a buy. The stream detects positions by watching on-chain token arrivals.

### Strategy options

At least one must be enabled:

| Condition | Field | Description |
|-----------|-------|-------------|
| Take profit | `target_profit_pct` | Exit at this % gain |
| Stop loss | `stop_loss_pct` | Exit at this % loss |
| Trailing stop | `trailing_stop_pct` | Exit when profit drops this % from peak |
| Deadline | `deadline_timeout_sec` | Exit after N seconds regardless of PnL |
| Graduation | `sell_on_graduation` | Exit when token graduates from bonding curve to DEX |
| Exit ladder | `take_profit_levels` | Partial sells at multiple profit thresholds |
| Liquidity guard | `liquidity_guard` | Check pool depth before exit signals |
| Breakeven trail | `breakeven_trail_pct` | Trailing stop from breakeven point |

### StrategyConfigBuilder

All 4 SDKs provide a fluent builder for strategy configuration:

```typescript
import { StrategyConfigBuilder } from "@lasersell/lasersell-sdk";

const strategy = new StrategyConfigBuilder()
  .stopLossPct(10)
  .takeProfitLevels([
    { profit_pct: 25, sell_pct: 30, trailing_stop_pct: 0 },
    { profit_pct: 50, sell_pct: 50, trailing_stop_pct: 3 },
    { profit_pct: 100, sell_pct: 100, trailing_stop_pct: 5 },
  ])
  .liquidityGuard(true)
  .breakevenTrailPct(2)
  .build();
```

Builder methods: `targetProfitPct`, `stopLossPct`, `trailingStopPct`, `sellOnGraduation`, `takeProfitLevels`, `liquidityGuard`, `breakevenTrailPct`.

Python: `StrategyConfigBuilder().target_profit_pct(50).stop_loss_pct(10).build()`
Rust: `StrategyConfigBuilder::new().target_profit_pct(50.0).stop_loss_pct(10.0).build()`
Go: `stream.NewStrategyConfigBuilder().TargetProfitPct(50.0).StopLossPct(10.0).Build()`

### Connect and receive events

```typescript
import { StreamClient, StreamSession, proveOwnership, ExitApiClient,
  signUnsignedTx, sendTransaction, sendTargetHeliusSender } from "@lasersell/lasersell-sdk";

// Register wallet first (required)
const proof = proveOwnership(keypair);
await ExitApiClient.withApiKey(apiKey).registerWallet(proof);

const session = await StreamSession.connect(new StreamClient(apiKey), {
  wallet_pubkeys: [walletPubkey],
  strategy: { target_profit_pct: 50, stop_loss_pct: 10, trailing_stop_pct: 5 },
  deadline_timeout_sec: 120,
  send_mode: "helius_sender",
  tip_lamports: 1000,
});

while (true) {
  const event = await session.recv();
  if (event === null) break;
  switch (event.type) {
    case "position_opened":
      console.log("New position:", event.message.mint, "watched:", event.message.watched);
      break;
    case "exit_signal_with_tx":
      if (event.message.type === "exit_signal_with_tx") {
        const signed = signUnsignedTx(event.message.unsigned_tx_b64, signer);
        await sendTransaction(sendTargetHeliusSender(), signed);
      }
      break;
  }
}
```

### Stream events

| Event | Description |
|-------|-------------|
| `position_opened` | New token position detected |
| `pnl_update` | Profit/loss update |
| `liquidity_snapshot` | Slippage bands + trend (Tier 1+) |
| `balance_update` | Token balance changed |
| `exit_signal_with_tx` | Exit triggered with unsigned transaction |
| `position_closed` | Position closed |
| `trade_tick` | Real-time trade on a tracked position's token |

### Mid-session updates

```typescript
session.sender().updateWallets(["WALLET_1", "WALLET_2"]);       // replace monitored wallets
session.sender().updateStrategy({ target_profit_pct: 100 });     // applies to all positions
session.sender().updatePositionStrategy(positionId, strategy);   // override single position
session.sender().updateWatchWallets([{ pubkey: "WATCH..." }]);   // update copy trading wallets
session.sender().closeById(positionId);                          // manually close a position
session.sender().requestExitSignalById(positionId, 500);         // trigger exit with 5% slippage
```

### Per-position strategy overrides

Override the global strategy for individual positions. Overrides are ephemeral (not persisted across reconnections).

```typescript
session.sender().updatePositionStrategy(positionId, {
  target_profit_pct: 200, stop_loss_pct: 5, trailing_stop_pct: 10,
});
```

Python: `session.sender().update_position_strategy(position_id, {...})`
Rust: `session.sender().update_position_strategy(position_id, StrategyConfigMsg { ... })?`
Go: `sender.UpdatePositionStrategy(positionID, stream.StrategyConfigMsg{...})`

### Liquidity snapshots (Tier 1+)

```typescript
const bands = session.getSlippageBands(positionId);
const maxTokens = session.getMaxSellAtSlippage(positionId, 500); // max tokens at 5% slippage
const trend = session.getLiquidityTrend(positionId); // "growing" | "stable" | "draining"
```

### Priority lanes (TypeScript + Rust only)

Split the stream into hi/lo priority channels:

```typescript
const lanes = await client.connectLanes(configure, { lowPriorityCapacity: 1024 });
```

## Copy Trading (Watch Wallets)

Copy trading mirrors trades from external wallets. When a watched wallet opens a position, the stream detects it and can optionally auto-buy the same token on your behalf.

**Setup:**

1. Register all wallets (your own + any you want to watch)
2. Add watch wallets to `configure` or via `updateWatchWallets` mid-session
3. Stream sends events for watched wallet trades with `watched: true`
4. Optionally configure `auto_buy` to automatically mirror buys

**Connection with watch wallets:**

```typescript
const session = await StreamSession.connect(new StreamClient(apiKey), {
  wallet_pubkeys: [myWalletPubkey],
  strategy: { target_profit_pct: 50, stop_loss_pct: 10 },
  watch_wallets: [
    { pubkey: "TraderToWatch1..." },
    { pubkey: "TraderToWatch2...", auto_buy: {
      wallet_pubkey: myWalletPubkey,
      amount_quote_units: 100_000_000, // 0.1 SOL
    }},
  ],
  deadline_timeout_sec: 120,
});
```

**Mid-session:** `session.sender().updateWatchWallets([{ pubkey: "NewTrader..." }])`
Python: `session.sender().update_watch_wallets([{"pubkey": "..."}])`
Rust: `session.sender().update_watch_wallets(vec![WatchWalletEntryMsg { pubkey: "...".into(), auto_buy: None }])?`
Go: `sender.UpdateWatchWallets([]stream.WatchWalletEntryMsg{{Pubkey: "..."}})`

**Auto-buy fields:** `wallet_pubkey` (your buy wallet), `amount_quote_units` (SOL atomic units), `amount_usd1_units` (optional USD1 alternative).

**Identifying watched positions:**

```typescript
if (event.type === "position_opened" && event.message.watched) {
  console.log("Copied trade:", event.handle.wallet_pubkey);
  // Apply tighter strategy for copied positions
  session.sender().updatePositionStrategy(event.handle.position_id, {
    target_profit_pct: 30, stop_loss_pct: 8, trailing_stop_pct: 5,
  });
}
```

## Transaction Submission

| Target | Constructor (TS) | Best for |
|--------|-------------------|----------|
| Default RPC | `sendTargetDefaultRpc()` | Development (rate-limited) |
| Custom RPC | `sendTargetRpc(url)` | Private RPC endpoint |
| Helius Sender | `sendTargetHeliusSender()` | Production (recommended) |
| Astralane Iris | `sendTargetAstralane(key, region?)` | Multi-region production |

## Error Handling

| Kind | Retryable | Description |
|------|-----------|-------------|
| `transport` | Yes | Network error (DNS, timeout) |
| `http_status` | Depends | Non-200 HTTP response |
| `envelope_status` | No | API returned error in body |
| `parse` | No | Failed to parse response |

```typescript
import { retryAsync, LOW_LATENCY_RETRY_POLICY, ExitApiError } from "@lasersell/lasersell-sdk";
const result = await retryAsync(
  LOW_LATENCY_RETRY_POLICY,
  () => client.buildSellTx(request),
  (error) => error instanceof ExitApiError && error.isRetryable(),
);
```

## Anti-Patterns

- **Never** send private keys to the API. All signing is local.
- **Never** buy before the stream is connected. Stream detects positions via on-chain token arrivals.
- **Never** use `amount_tokens: 0` on buy requests. Zero means "sell all" on sells only.
- **Never** set `slippage_bps` above 10000. The API rejects it.
- **Never** use the public RPC in production. Use Helius Sender or a private RPC.
- **Never** set both `partner_fee_bps` and `partner_fee_lamports`. They are mutually exclusive.
- **Never** connect to the stream without registering wallets first.

## Resources

- [API Reference](resources/api-reference.md) | [Types Reference](resources/types-reference.md) | [Stream Protocol](resources/stream-protocol.md)
- [Program Addresses](resources/program-addresses.md) | [Troubleshooting](docs/troubleshooting.md)
- [AI Agent Integration](docs/ai-agent-integration.md) | [Strategy Guide](docs/strategy-guide.md)
- [SDK Repository](https://github.com/lasersell/lasersell-sdk) | [API Docs](https://docs.lasersell.io/api/overview) | [MCP Server](https://docs.lasersell.io/ai-agents/mcp-server)
